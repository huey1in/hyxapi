package model

import (
	"errors"
	"math"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionRedemptionLookupFailureIsNotAMissingCode(t *testing.T) {
	truncateTables(t)
	user := insertUserForPaymentGuardTest(t, 88029, 100)
	_, err := RedeemSubscriptionCode("missing-code", user.Id)
	require.EqualError(t, err, "无效的兑换码")
	const callback = "test:subscription_redemption_lookup_error"
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_redemptions" {
			tx.AddError(errors.New("injected database failure"))
		}
	}))
	t.Cleanup(func() { DB.Callback().Query().Remove(callback) })
	_, err = RedeemSubscriptionCode("missing-code", user.Id)
	require.EqualError(t, err, "Unable to redeem subscription code")
	require.Equal(t, 100, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestSubscriptionCodeBatchRollsBackAndRejectsExpiredDrafts(t *testing.T) {
	truncateTables(t)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 88030)
	const callback = "test:subscription_code_batch_failure"
	attempts := 0
	require.NoError(t, DB.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_redemptions" {
			attempts++
			if attempts == 2 {
				tx.AddError(errors.New("injected second-code failure"))
			}
		}
	}))
	t.Cleanup(func() { DB.Callback().Create().Remove(callback) })
	codes, err := GenerateSubscriptionCodes(plan.Id, 3, 0)
	require.Error(t, err)
	require.Nil(t, codes)
	var count int64
	require.NoError(t, DB.Model(&SubscriptionRedemption{}).Where("plan_id = ?", plan.Id).Count(&count).Error)
	require.Zero(t, count, "failed generation must not leave an undisclosed partial batch")
	require.NoError(t, DB.Callback().Create().Remove(callback))
	for _, expiry := range []int64{-1, time.Now().Unix() - 1} {
		_, err = GenerateSubscriptionCodes(plan.Id, 1, expiry)
		require.Error(t, err)
	}
	expiry := time.Now().Unix() + 3600
	codes, err = GenerateSubscriptionCodes(plan.Id, 3, expiry)
	require.NoError(t, err)
	require.Len(t, codes, 3)
	for _, code := range codes {
		require.Equal(t, expiry, code.ExpiredTime)
	}
}

func TestBalancePurchasePreservesRestrictionsAndRollsBackRejectedPurchase(t *testing.T) {
	truncateTables(t)
	user := insertUserForPaymentGuardTest(t, 88021, 10000000)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 88021)
	plan.PriceAmount = 2
	plan.MaxPurchasePerUser = 1
	plan.AllowedGroups = `["pro"]`
	plan.AllowedModels = `["gpt-test"]`
	plan.ConcurrentLimit, plan.RPMLimit = 3, 42
	plan.UpgradeGroup, plan.DowngradeGroup = "pro", "default"
	plan.AllowWalletOverflow = common.GetPointer(false)
	require.NoError(t, DB.Save(plan).Error)
	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))
	required := int(2 * common.QuotaPerUnit)
	require.Equal(t, 10000000-required, getUserQuotaForPaymentGuardTest(t, user.Id))
	var sub UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&sub).Error)
	require.Equal(t, plan.AllowedGroups, sub.AllowedGroups)
	require.Equal(t, plan.AllowedModels, sub.AllowedModels)
	require.Equal(t, 3, sub.ConcurrentLimit)
	require.Equal(t, 42, sub.RPMLimit)
	require.False(t, sub.AllowWalletOverflow)
	require.Equal(t, "balance", sub.Source)
	require.Equal(t, "pro", sub.UpgradeGroup)
	require.Error(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))
	require.Equal(t, 10000000-required, getUserQuotaForPaymentGuardTest(t, user.Id), "limit rejection must roll back the wallet debit")
	require.EqualValues(t, 1, countUserSubscriptionsForPaymentGuardTest(t, user.Id))
	var orders int64
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("user_id = ?", user.Id).Count(&orders).Error)
	require.EqualValues(t, 1, orders)
	plan.AllowBalancePay = common.GetPointer(false)
	require.NoError(t, DB.Save(plan).Error)
	require.Error(t, PurchaseSubscriptionWithBalance(user.Id, plan.Id))
	require.Equal(t, 10000000-required, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestSubscriptionCompletionAndRefundUseSingleConnectionAndAreIdempotent(t *testing.T) {
	truncateTables(t)
	user := insertUserForPaymentGuardTest(t, 88022, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 88022)
	insertSubscriptionOrderForPaymentGuardTest(t, "subscription-paid-once", user.Id, plan.Id, PaymentProviderStripe)
	for range 2 {
		require.NoError(t, CompleteSubscriptionOrder("subscription-paid-once", `{}`, PaymentProviderStripe, ""))
	}
	require.EqualValues(t, 1, countUserSubscriptionsForPaymentGuardTest(t, user.Id))
	result, err := PreConsumeUserSubscription("subscription-reservation", user.Id, "any", 0, 30)
	require.NoError(t, err)
	require.NotNil(t, result)
	for range 2 {
		require.NoError(t, RefundSubscriptionPreConsume("subscription-reservation"))
	}
	var sub UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&sub).Error)
	require.Zero(t, sub.AmountUsed)
	require.NoError(t, DB.Model(&sub).Update("amount_total", int64(math.MaxInt64)).Error)
	require.NoError(t, DB.Model(&sub).Update("amount_used", int64(math.MaxInt64-1)).Error)
	require.Error(t, PostConsumeUserSubscriptionDelta(sub.Id, 2))
	require.NoError(t, DB.First(&sub, sub.Id).Error)
	require.Equal(t, int64(math.MaxInt64-1), sub.AmountUsed)
}

func TestSubscriptionRedemptionRetainsPurchasedPlansAndRenewsLocalRestrictions(t *testing.T) {
	truncateTables(t)
	user := insertUserForPaymentGuardTest(t, 88023, 10000000)
	require.NoError(t, DB.Model(user).Update("group", "default").Error)
	bought := insertSubscriptionPlanForPaymentGuardTest(t, 88023)
	bought.PriceAmount = 1
	require.NoError(t, DB.Save(bought).Error)
	require.NoError(t, PurchaseSubscriptionWithBalance(user.Id, bought.Id))
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 88024)
	plan.UpgradeGroup = "pro"
	plan.AllowedModels = `["first"]`
	require.NoError(t, DB.Save(plan).Error)
	code := &SubscriptionRedemption{PlanId: plan.Id, Key: "subscription-redeem-1", Status: SubscriptionRedemptionStatusEnabled, CreatedTime: time.Now().Unix()}
	require.NoError(t, DB.Create(code).Error)
	_, err := RedeemSubscriptionCode(code.Key, user.Id)
	require.NoError(t, err)
	var paid UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND plan_id = ?", user.Id, bought.Id).First(&paid).Error)
	require.Equal(t, "active", paid.Status, "redeeming a separate plan must retain a paid subscription")
	var redeemed UserSubscription
	require.NoError(t, DB.Where("user_id = ? AND source = ?", user.Id, "redemption").First(&redeemed).Error)
	previousEnd := redeemed.EndTime
	plan.AllowedModels, plan.RPMLimit = `["second"]`, 12
	plan.AllowWalletOverflow = common.GetPointer(false)
	require.NoError(t, DB.Save(plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	code = &SubscriptionRedemption{PlanId: plan.Id, Key: "subscription-redeem-2", Status: SubscriptionRedemptionStatusEnabled}
	require.NoError(t, DB.Create(code).Error)
	_, err = RedeemSubscriptionCode(code.Key, user.Id)
	require.NoError(t, err)
	require.NoError(t, DB.First(&redeemed, redeemed.Id).Error)
	require.Greater(t, redeemed.EndTime, previousEnd)
	require.Equal(t, `["second"]`, redeemed.AllowedModels)
	require.Equal(t, 12, redeemed.RPMLimit)
	require.False(t, redeemed.AllowWalletOverflow)
	require.EqualValues(t, 2, countUserSubscriptionsForPaymentGuardTest(t, user.Id))
}

func TestManualCreemCompletionCreditsRawQuotaOnce(t *testing.T) {
	truncateTables(t)
	user := insertUserForPaymentGuardTest(t, 88025, 10)
	order := &TopUp{UserId: user.Id, Amount: 1250000, Money: 2.5, TradeNo: "manual-creem-credit", PaymentMethod: PaymentMethodCreem, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	for range 2 {
		require.NoError(t, ManualCompleteTopUp(order.TradeNo, "127.0.0.1"))
	}
	require.Equal(t, 1250010, getUserQuotaForPaymentGuardTest(t, user.Id))
}
