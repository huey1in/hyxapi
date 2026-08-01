package service

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTaskBillingTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalRedisEnabled := common.RedisEnabled
	originalBatchUpdateEnabled := common.BatchUpdateEnabled
	originalLogConsumeEnabled := common.LogConsumeEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Log{}))
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.RedisEnabled = originalRedisEnabled
		common.BatchUpdateEnabled = originalBatchUpdateEnabled
		common.LogConsumeEnabled = originalLogConsumeEnabled
	})
	return db
}

func createTaskBillingTestUser(t *testing.T, db *gorm.DB, id, quota int) {
	t.Helper()
	require.NoError(t, db.Create(&model.User{
		Id:           id,
		Username:     "task-billing-user",
		Password:     "test-password",
		Quota:        quota,
		UsedQuota:    100,
		RequestCount: 1,
	}).Error)
}

func createTaskBillingTestChannel(t *testing.T, db *gorm.DB, id int) {
	t.Helper()
	require.NoError(t, db.Create(&model.Channel{
		Id:        id,
		Key:       "test-key",
		Name:      "task-billing-channel",
		UsedQuota: 100,
	}).Error)
}

func TestCalculateTaskTokenQuotaSplitsKnownCompletionTokens(t *testing.T) {
	context := &model.TaskBillingContext{
		InputPrice:  2,
		OutputPrice: 10,
		GroupRatio:  1.5,
		OtherRatios: map[string]float64{"quality": 2},
	}

	quota, strategy := calculateTaskTokenQuota(context, 2_000_000, 500_000, 100)

	// (1.5M * $2/M + 0.5M * $10/M) * group 1.5 * quality 2 * quota/unit 100
	require.Equal(t, 2400, quota)
	require.Equal(t, "split-input-output", strategy)
}

func TestCalculateTaskTokenQuotaUsesInputPriceWhenOnlyTotalIsKnown(t *testing.T) {
	context := &model.TaskBillingContext{
		InputPrice:  2,
		OutputPrice: 10,
		GroupRatio:  1.5,
		OtherRatios: map[string]float64{"quality": 2},
	}

	quota, strategy := calculateTaskTokenQuota(context, 2_000_000, 0, 100)

	// The task result does not identify input/output tokens, so do not infer an
	// output split. Charge all known tokens at the input unit price.
	require.Equal(t, 1200, quota)
	require.Equal(t, "total-tokens-input-price", strategy)
}

func TestCalculateTaskTokenQuotaTreatsZeroGroupAsValidZeroPrice(t *testing.T) {
	pricing := &model.TaskBillingContext{
		InputPrice: 2,
		GroupRatio: 0,
	}

	quota, strategy := calculateTaskTokenQuota(pricing, 1_000, 0, 100)

	require.Zero(t, quota)
	require.Equal(t, "total-tokens-input-price", strategy)
}

func TestRecalculateTaskQuotaRefundsPreConsumedQuotaWhenActualIsZero(t *testing.T) {
	db := setupTaskBillingTestDB(t)
	createTaskBillingTestUser(t, db, 301, 100)
	createTaskBillingTestChannel(t, db, 401)
	task := &model.Task{
		TaskID:    "zero-actual-quota",
		UserId:    301,
		ChannelId: 401,
		Quota:     100,
		Group:     "free",
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "priced-model",
			},
		},
	}

	RecalculateTaskQuota(context.Background(), task, 0, "valid zero-cost result")

	require.Zero(t, task.Quota)
	var user model.User
	require.NoError(t, db.First(&user, 301).Error)
	require.Equal(t, 200, user.Quota)
	require.Zero(t, user.UsedQuota)
	require.Equal(t, 1, user.RequestCount)
	var channel model.Channel
	require.NoError(t, db.First(&channel, 401).Error)
	require.Zero(t, channel.UsedQuota)
	var refundLog model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeRefund).First(&refundLog).Error)
	require.Equal(t, 100, refundLog.Quota)
}

func TestRecalculateTaskQuotaByTokensRefundsWhenValidUsageCostsZero(t *testing.T) {
	db := setupTaskBillingTestDB(t)
	createTaskBillingTestUser(t, db, 302, 100)
	createTaskBillingTestChannel(t, db, 402)
	task := &model.Task{
		TaskID:    "zero-group-ratio",
		UserId:    302,
		ChannelId: 402,
		Quota:     100,
		Group:     "free",
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			BillingContext: &model.TaskBillingContext{
				BillingType:     model.ModelPricingBillingToken,
				InputPrice:      2,
				OutputPrice:     4,
				GroupRatio:      0,
				OriginModelName: "priced-model",
			},
		},
	}

	RecalculateTaskQuotaByTokens(context.Background(), task, 1_000, 200)

	require.Zero(t, task.Quota)
	var user model.User
	require.NoError(t, db.First(&user, 302).Error)
	require.Equal(t, 200, user.Quota)
	require.Zero(t, user.UsedQuota)
	require.Equal(t, 1, user.RequestCount)
	var channel model.Channel
	require.NoError(t, db.First(&channel, 402).Error)
	require.Zero(t, channel.UsedQuota)
}

func TestRecalculateTaskQuotaChargesPositiveDeltaWithoutChangingRequestCount(t *testing.T) {
	db := setupTaskBillingTestDB(t)
	createTaskBillingTestUser(t, db, 304, 100)
	createTaskBillingTestChannel(t, db, 404)
	task := &model.Task{
		TaskID:    "positive-quota-delta",
		UserId:    304,
		ChannelId: 404,
		Quota:     100,
		Group:     "default",
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "priced-model",
			},
		},
	}

	RecalculateTaskQuota(context.Background(), task, 150, "actual usage exceeded reserve")

	require.Equal(t, 150, task.Quota)
	var user model.User
	require.NoError(t, db.First(&user, 304).Error)
	require.Equal(t, 50, user.Quota)
	require.Equal(t, 150, user.UsedQuota)
	require.Equal(t, 1, user.RequestCount)
	var channel model.Channel
	require.NoError(t, db.First(&channel, 404).Error)
	require.EqualValues(t, 150, channel.UsedQuota)
}

func TestRefundTaskQuotaReversesPreConsumedUsageWithoutChangingRequestCount(t *testing.T) {
	db := setupTaskBillingTestDB(t)
	createTaskBillingTestUser(t, db, 303, 100)
	createTaskBillingTestChannel(t, db, 403)
	task := &model.Task{
		TaskID:    "failed-task-refund",
		UserId:    303,
		ChannelId: 403,
		Quota:     100,
		Group:     "default",
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "priced-model",
			},
		},
	}

	RefundTaskQuota(context.Background(), task, "upstream task failed")

	var user model.User
	require.NoError(t, db.First(&user, 303).Error)
	require.Equal(t, 200, user.Quota)
	require.Zero(t, user.UsedQuota)
	require.Equal(t, 1, user.RequestCount)
	var channel model.Channel
	require.NoError(t, db.First(&channel, 403).Error)
	require.Zero(t, channel.UsedQuota)
}
