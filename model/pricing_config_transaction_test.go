package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func isolatePricingConfig(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Ability{}, &Model{}, &Vendor{}))
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	previousConfig := config.GlobalConfig.ExportAllConfigs()
	restore := []struct {
		value string
		apply func(string) error
	}{
		{ratio_setting.ModelPrice2JSONString(), ratio_setting.UpdateModelPriceByJSONString},
		{ratio_setting.ModelRatio2JSONString(), ratio_setting.UpdateModelRatioByJSONString},
		{ratio_setting.CompletionRatio2JSONString(), ratio_setting.UpdateCompletionRatioByJSONString},
		{ratio_setting.CacheRatio2JSONString(), ratio_setting.UpdateCacheRatioByJSONString},
		{ratio_setting.CreateCacheRatio2JSONString(), ratio_setting.UpdateCreateCacheRatioByJSONString},
		{ratio_setting.ImageRatio2JSONString(), ratio_setting.UpdateImageRatioByJSONString},
		{ratio_setting.AudioRatio2JSONString(), ratio_setting.UpdateAudioRatioByJSONString},
		{ratio_setting.AudioCompletionRatio2JSONString(), ratio_setting.UpdateAudioCompletionRatioByJSONString},
	}
	t.Cleanup(func() {
		for _, saved := range restore {
			require.NoError(t, saved.apply(saved.value))
		}
		config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{
			"billing_mode":        previousConfig["billing_setting.billing_mode"],
			"billing_expr":        previousConfig["billing_setting.billing_expr"],
			"plugin_billing_expr": previousConfig[billing_setting.PluginBillingExprOption],
		})
		common.OptionMap = previousOptions
		InvalidatePricingCache()
	})
}

func TestPricingConfigTransactionRejectsInvalidBatchAndStaleVersion(t *testing.T) {
	isolatePricingConfig(t)
	const name = "transaction-price"
	initial, err := GetModelPricingSnapshot([]string{name})
	require.NoError(t, err)
	change := ModelPricingChange{ModelName: name, ExpectedVersion: initial.Entries[0].Version,
		Pricing: PricingValues{"billing_setting.billing_mode": "tiered_expr", "billing_setting.billing_expr": `tier("base", p * 2 + c * 8)`}}
	invalid := ModelPricingChange{ModelName: "transaction-invalid", ExpectedVersion: initial.EmptyVersion,
		Pricing: PricingValues{"billing_setting.billing_expr": "("}}
	require.Error(t, UpdateModelPricing([]ModelPricingChange{change, invalid}))
	after, err := GetModelPricingSnapshot([]string{name})
	require.NoError(t, err)
	require.Equal(t, initial.Entries[0].Version, after.Entries[0].Version)
	require.NoError(t, UpdateModelPricing([]ModelPricingChange{change}))
	require.Equal(t, billing_setting.BillingModeTieredExpr, billing_setting.GetBillingMode(name))
	require.ErrorIs(t, UpdateModelPricing([]ModelPricingChange{change}), ErrModelPricingConflict)
	require.Error(t, UpdateOptionsBulk(map[string]string{"billing_setting.billing_expr": "[]"}))
	require.Error(t, UpdateOptionsBulk(map[string]string{"billing_setting.billing_expr": "{}", "RetryTimes": "9"}))
	expression, ok := billing_setting.GetBillingExpr(name)
	require.True(t, ok)
	require.Equal(t, change.Pricing["billing_setting.billing_expr"], expression)
}

func TestDirectPricingConversionPreservesZeroAndIndependentMediaPrices(t *testing.T) {
	isolatePricingConfig(t)
	price := &ModelPricing{ModelName: "direct-conversion", Enabled: true, OutputPrice: 5, AudioInputPrice: 8, AudioOutputPrice: 12}
	require.NoError(t, SaveModelPricing(price))
	preview, err := PreviewDirectModelPricingConversion(price.ModelName)
	require.NoError(t, err)
	used := billingexpr.UsedVarsByHash(preview.Expression, billingexpr.ExprHashString(preview.Expression))
	for _, key := range []string{"p", "c", "cr", "cc", "cc1h", "img", "ai", "ao"} {
		require.True(t, used[key], key)
	}
	cost, _, err := billingexpr.RunExpr(preview.Expression, billingexpr.TokenParams{P: 1000, C: 100, CR: 400, CC: 50, CC1h: 20, Img: 100, AI: 20, AO: 10})
	require.NoError(t, err)
	require.Equal(t, float64(780), cost)
	// Previewing does not switch relay precedence or persist a billing mode.
	snapshot, err := GetModelPricingSnapshot([]string{price.ModelName})
	require.NoError(t, err)
	require.Equal(t, "direct", snapshot.Entries[0].Source)
	require.NotContains(t, snapshot.Entries[0].Configured, "billing_setting.billing_mode")
}

func TestPublicPricingUsesActiveExpressionInsteadOfInactiveDirectQuote(t *testing.T) {
	isolatePricingConfig(t)
	name := "public-expression"
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: name, Enabled: true, InputPrice: 123}))
	require.NoError(t, UpdateModelPricing([]ModelPricingChange{{ModelName: name, ExpectedVersion: ModelPricingVersion(PricingValues{}),
		Pricing: PricingValues{"billing_setting.billing_mode": "tiered_expr", "billing_setting.billing_expr": `tier("request", fixed(0.01))`}}}))
	quote := Pricing{ModelName: name, Configured: true, InputPrice: 123}
	populateAdvancedPricing(&quote)
	require.Equal(t, "expression", quote.BillingType)
	require.Equal(t, `tier("request", fixed(0.01))`, quote.BillingExpr)
	require.Zero(t, quote.InputPrice)
}
