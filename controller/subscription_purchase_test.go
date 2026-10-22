package controller

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionOffersAndBalancePurchaseRespectPlanRestrictions(t *testing.T) {
	user := paymentFixture(t)
	initialQuota := int(4 * common.QuotaPerUnit)
	require.NoError(t, model.DB.Model(user).Update("quota", initialQuota).Error)
	plan := model.SubscriptionPlan{
		Title: "Balance plan", Enabled: true, PriceAmount: 2, Currency: "USD",
		DurationUnit: "day", DurationValue: 30, TotalAmount: 100, MaxPurchasePerUser: 1,
	}
	require.NoError(t, model.DB.Create(&plan).Error)
	disabledPlan := model.SubscriptionPlan{Title: "Disabled plan"}
	require.NoError(t, model.DB.Create(&disabledPlan).Error)
	require.NoError(t, model.DB.Model(&disabledPlan).Update("enabled", false).Error)
	response := paymentRequest(t, GetSubscriptionPlans, user.Id, "", "")
	var offers struct {
		Success bool
		Data    []SubscriptionPlanDTO
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &offers))
	require.True(t, offers.Success, response.Body.String())
	require.Len(t, offers.Data, 1)
	require.Equal(t, plan.Id, offers.Data[0].Plan.Id)

	for _, expected := range []bool{true, false} {
		response = paymentRequest(t, SubscriptionRequestBalancePay, user.Id, fmt.Sprintf(`{"plan_id":%d}`, plan.Id), "")
		var result struct{ Success bool }
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.Equal(t, expected, result.Success, response.Body.String())
		var stored model.User
		require.NoError(t, model.DB.First(&stored, user.Id).Error)
		require.Equal(t, initialQuota-int(2*common.QuotaPerUnit), stored.Quota)
		var subscriptions int64
		require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", user.Id).Count(&subscriptions).Error)
		require.EqualValues(t, 1, subscriptions)
	}
}
