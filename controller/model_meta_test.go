package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestEnrichModelsAggregatesQuotaTypesForEveryNameRule(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	channel := &model.Channel{Name: "quota-test", Status: 1, Models: "quota-token-end,quota-request-end"}
	require.NoError(t, db.Create(channel).Error)
	for _, price := range []model.ModelPricing{
		{ModelName: "quota-token-end", Enabled: true, InputPrice: 2},
		{ModelName: "quota-request-end", Enabled: true, BillingType: model.ModelPricingBillingRequest, RequestPrice: 0.25},
	} {
		require.NoError(t, model.SaveModelPricing(&price))
		require.NoError(t, db.Create(&model.Ability{ChannelId: channel.Id, Group: "default", Model: price.ModelName, Enabled: true}).Error)
	}
	model.InvalidatePricingCache()
	t.Cleanup(model.InvalidatePricingCache)
	rows := []*model.Model{
		{ModelName: "quota-token-end", NameRule: model.NameRuleExact},
		{ModelName: "quota-request-end", NameRule: model.NameRuleExact},
		{ModelName: "quota-", NameRule: model.NameRulePrefix},
		{ModelName: "-end", NameRule: model.NameRuleSuffix},
		{ModelName: "a-", NameRule: model.NameRuleContains},
		{ModelName: "missing", NameRule: model.NameRulePrefix, QuotaTypes: []int{1}},
	}
	require.NoError(t, enrichModels(rows))
	require.Equal(t, []int{0}, rows[0].QuotaTypes)
	require.Equal(t, []int{1}, rows[1].QuotaTypes)
	for _, row := range rows[2:5] {
		require.Equal(t, []int{0, 1}, row.QuotaTypes)
		require.Equal(t, 2, row.MatchedCount)
	}
	require.Empty(t, rows[5].QuotaTypes, "unmatched rules must not retain stale metadata")
}
