package model

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func checkinFixture(t *testing.T) User {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Checkin{}))
	t.Cleanup(func() { DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Checkin{}) })
	setting := operation_setting.GetCheckinSetting()
	previous := *setting
	*setting = operation_setting.CheckinSetting{Enabled: true, MinQuota: 75, MaxQuota: 75}
	t.Cleanup(func() { *setting = previous })
	user := User{Username: "checkin-fixture", Quota: 100, UsedQuota: 17, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	t.Cleanup(func() { DB.Unscoped().Delete(&user) })
	return user
}

func checkCheckinConcurrentCredit(t *testing.T) {
	t.Helper()
	user := checkinFixture(t)
	useUserCacheMiniRedis(t)
	require.NoError(t, populateUserCache(user))
	// A pending relay reservation must survive the committed reward.
	require.NoError(t, cacheIncrUserQuota(user.Id, -10))
	start, results := make(chan struct{}), make(chan error, 8)
	var workers sync.WaitGroup
	for range 8 {
		workers.Go(func() { <-start; _, err := UserCheckinContext(context.Background(), user.Id); results <- err })
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
	require.Equal(t, 175, stored.Quota)
	require.Equal(t, 17, stored.UsedQuota)
	cached, err := getUserQuotaCache(user.Id)
	require.NoError(t, err)
	require.Equal(t, 165, cached)
	stats, err := GetUserCheckinStats(user.Id, time.Now().Format("2006-01"))
	require.NoError(t, err)
	require.EqualValues(t, 1, stats["total_checkins"])
	require.EqualValues(t, 1, stats["checkin_count"])
	require.Equal(t, []CheckinRecord{{CheckinDate: time.Now().Format("2006-01-02"), QuotaAwarded: 75}}, stats["records"])
	require.Equal(t, true, stats["checked_in_today"])
}

func TestCheckinConcurrentCreditPreservesReservations(t *testing.T) {
	checkCheckinConcurrentCredit(t)
}

func TestCheckinConcurrentCreditMySQL(t *testing.T) {
	db := openIsolatedMySQLMigrationDB(t)
	previousDB, previousLogDB, previousType := DB, LOG_DB, common.MainDatabaseType()
	DB, LOG_DB = db, db
	common.SetMainDatabaseType(common.DatabaseTypeMySQL)
	initCol()
	t.Cleanup(func() { DB, LOG_DB = previousDB, previousLogDB; common.SetMainDatabaseType(previousType); initCol() })
	require.NoError(t, db.AutoMigrate(&User{}))
	checkCheckinConcurrentCredit(t)
}

func TestCheckinFailedCreditRollsBackAndRejectsInvalidRewards(t *testing.T) {
	user := checkinFixture(t)
	require.NoError(t, DB.Exec("CREATE TEMP TRIGGER checkin_credit_failure BEFORE UPDATE OF quota ON users BEGIN SELECT RAISE(ABORT,'fixture credit failure'); END").Error)
	_, err := UserCheckinContext(context.Background(), user.Id)
	require.ErrorContains(t, err, "fixture credit failure")
	require.NoError(t, DB.Exec("DROP TRIGGER checkin_credit_failure").Error)
	assertNoRecord := func() {
		var count int64
		require.NoError(t, DB.Model(&Checkin{}).Count(&count).Error)
		require.Zero(t, count)
	}
	assertNoRecord()
	require.NoError(t, DB.Model(&user).Update("quota", common.MaxWalletQuota-50).Error)
	_, err = UserCheckinContext(context.Background(), user.Id)
	require.ErrorIs(t, err, ErrWalletQuotaLimitExceeded)
	assertNoRecord()
	_, err = UserCheckinContext(context.Background(), user.Id+100000)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	assertNoRecord()
	for _, reward := range [][2]int{{-1, 5}, {5, 4}, {0, common.MaxWalletQuota + 1}} {
		setting := operation_setting.GetCheckinSetting()
		setting.MinQuota, setting.MaxQuota = reward[0], reward[1]
		_, err = UserCheckinContext(context.Background(), user.Id)
		require.ErrorContains(t, err, "Invalid check-in reward")
		assertNoRecord()
	}
	setting := operation_setting.GetCheckinSetting()
	setting.MinQuota, setting.MaxQuota = 0, 0
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = UserCheckinContext(ctx, user.Id)
	require.True(t, errors.Is(err, context.Canceled))
	assertNoRecord()
	_, err = UserCheckinContext(context.Background(), user.Id)
	require.NoError(t, err, "zero rewards still record the daily check-in")
}

func TestCheckinMonthStatsAreScopedAndValidated(t *testing.T) {
	user := checkinFixture(t)
	records := []Checkin{
		{UserId: user.Id, CheckinDate: "2024-02-29", QuotaAwarded: 9},
		{UserId: user.Id, CheckinDate: "2024-03-01", QuotaAwarded: 11},
		{UserId: user.Id + 1, CheckinDate: "2024-02-10", QuotaAwarded: 999},
	}
	require.NoError(t, DB.Create(&records).Error)
	stats, err := GetUserCheckinStats(user.Id, "2024-02")
	require.NoError(t, err)
	require.Equal(t, []CheckinRecord{{CheckinDate: "2024-02-29", QuotaAwarded: 9}}, stats["records"])
	require.EqualValues(t, 2, stats["total_checkins"])
	require.EqualValues(t, 1, stats["checkin_count"])
	require.NotContains(t, stats, "total_quota")
	for _, month := range []string{"2024-2", "2024-13", "2024-01-01", "0000-01", "invalid"} {
		_, err := GetUserCheckinStats(user.Id, month)
		require.ErrorContains(t, err, "Invalid check-in month")
	}
}
