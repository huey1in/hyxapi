package model

import (
	"fmt"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func redemptionFixture(t *testing.T) User {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))
	t.Cleanup(func() { DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&Redemption{}) })
	user := User{Username: "redemption-fixture", Quota: 50, Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func TestRedemptionConcurrentClaimCreditsOnceAndSynchronizesCache(t *testing.T) {
	user := redemptionFixture(t)
	useUserCacheMiniRedis(t)
	require.NoError(t, populateUserCache(user))
	code := Redemption{Key: "concurrent-claim", Name: "concurrent", Quota: 150}
	require.NoError(t, code.Insert())
	start := make(chan struct{})
	results := make(chan error, 8)
	var workers sync.WaitGroup
	for range 8 {
		workers.Go(func() { <-start; _, err := Redeem(code.Key, user.Id); results <- err })
	}
	close(start)
	workers.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		}
	}
	require.Equal(t, 1, successes)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 200, stored.Quota)
	cached, err := getUserQuotaCache(user.Id)
	require.NoError(t, err)
	require.Equal(t, 200, cached)
	require.NoError(t, DB.First(&code, code.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, code.Status)
	require.Equal(t, user.Id, code.UsedUserId)
	var logs int64
	require.NoError(t, LOG_DB.Model(&Log{}).Where("user_id = ? AND type = ?", user.Id, LogTypeTopup).Count(&logs).Error)
	require.EqualValues(t, 1, logs)
}

func TestRedemptionFailedCreditRollsBackClaimAndRejectsInvalidAmounts(t *testing.T) {
	user := redemptionFixture(t)
	require.NoError(t, DB.Model(&user).Update("quota", common.MaxWalletQuota-5).Error)
	code := Redemption{Key: "ceiling", Quota: 10}
	require.NoError(t, code.Insert())
	_, err := Redeem(code.Key, user.Id)
	require.Error(t, err)
	require.NoError(t, DB.First(&code, code.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
	require.Zero(t, code.UsedUserId)
	_, err = Redeem(code.Key, user.Id+100000)
	require.Error(t, err)
	require.NoError(t, DB.First(&code, code.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
	for _, amount := range []int{0, -1, common.MaxWalletQuota + 1} {
		invalid := Redemption{Key: fmt.Sprint(amount), Quota: amount}
		require.Error(t, invalid.Insert())
		code.Quota = amount
		require.Error(t, code.Update())
	}
	// Legacy invalid credits must not reduce a wallet or consume a code.
	legacy := Redemption{Key: "legacy-negative", Quota: -10}
	require.NoError(t, DB.Create(&legacy).Error)
	_, err = Redeem(legacy.Key, user.Id)
	require.Error(t, err)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, common.MaxWalletQuota-5, stored.Quota)
}

func TestRedemptionStaleAdminUpdateCannotResurrectClaimedCode(t *testing.T) {
	user := redemptionFixture(t)
	code := Redemption{Key: "stale-admin", Quota: 10}
	require.NoError(t, code.Insert())
	stale := code
	_, err := Redeem(code.Key, user.Id)
	require.NoError(t, err)
	stale.Status = common.RedemptionCodeStatusDisabled
	require.Error(t, stale.UpdateIfStatus(common.RedemptionCodeStatusEnabled))
	require.NoError(t, DB.First(&code, code.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, code.Status)
	require.Equal(t, user.Id, code.UsedUserId)
}

func TestRedemptionSearchFiltersAndBatchSoftDeletion(t *testing.T) {
	redemptionFixture(t)
	now := common.GetTimestamp()
	codes := []Redemption{
		{Key: "code-active", Name: "Batch Alpha", Quota: 10},
		{Key: "code-expired", Name: "Batch Alpha", Quota: 10, ExpiredTime: now - 10},
		{Key: "code-disabled", Name: "Batch Beta", Quota: 10, Status: common.RedemptionCodeStatusDisabled},
		{Key: "code-used", Name: "Batch Beta", Quota: 10, Status: common.RedemptionCodeStatusUsed},
	}
	require.NoError(t, DB.Create(&codes).Error)
	for _, filter := range []struct {
		keyword, status string
		count           int64
	}{
		{"Batch Alpha", "", 2}, {"code-", "", 4}, {fmt.Sprint(codes[0].Id), "", 1},
		{"", "1", 1}, {"", "2", 1}, {"", "3", 1}, {"", "expired", 1}, {"Batch Alpha", "2", 0},
	} {
		rows, total, err := SearchRedemptions(filter.keyword, filter.status, 0, 20)
		require.NoError(t, err)
		require.Equal(t, filter.count, total)
		require.Len(t, rows, int(total))
	}
	for _, ids := range [][]int{nil, {0}, {-1}, make([]int, 1001)} {
		_, err := BatchDeleteRedemptions(ids)
		require.Error(t, err)
	}
	count, err := BatchDeleteRedemptions([]int{codes[0].Id, codes[0].Id, codes[2].Id, 100000})
	require.NoError(t, err)
	require.EqualValues(t, 2, count)
	var total int64
	require.NoError(t, DB.Model(&Redemption{}).Count(&total).Error)
	require.EqualValues(t, 2, total)
	require.NoError(t, DB.Unscoped().Model(&Redemption{}).Count(&total).Error)
	require.EqualValues(t, 4, total)
}
