package model

import (
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestPublicPricingKeepsBaseQuotaTypeAcrossProviderOverrides(t *testing.T) {
	isolatePricingConfig(t)
	registry := pricingTestRegistry(t)
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"ModelPrice":                            `{"public-task":0.25}`,
		billing_setting.PluginBillingExprOption: `{"public-alpha::public-task":"tier(\"seconds\", u(\"seconds\") * 0.05)"}`,
	}))
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "public-task", Enabled: true}).Error)
	t.Cleanup(func() { DB.Where("model = ?", "public-task").Delete(&Ability{}) })
	InvalidatePricingCache()
	quotes := GetPricing()
	require.Len(t, quotes, 1)
	quote := quotes[0]
	selected, found := registry.Generation().GetByModel("public-task")
	require.True(t, found)
	if selected.Meta.Key == "public-alpha" {
		require.Equal(t, "expression", quote.BillingType)
	}
	require.Equal(t, 1, quote.QuotaType)
	require.Equal(t, 0.25, quote.RequestPrice)
	require.Equal(t, []int{1}, GetModelQuotaTypes("public-task"))
	variants := map[string]PricingPluginVariant{}
	for _, variant := range quote.BillingPluginVariants {
		variants[variant.PluginKey] = variant
	}
	require.Equal(t, "tiered_expr", variants["public-alpha"].BillingMode)
	require.Equal(t, "ratio", variants["public-beta"].BillingMode)
	encoded, err := json.Marshal(quote)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"quota_type":1`)

	// A changed base schedule must refresh metadata immediately, including the
	// zero-valued JSON field used by clients to distinguish token prices.
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"ModelPrice": `{}`, "ModelRatio": `{"public-task":2}`,
	}))
	quotes = GetPricing()
	require.Equal(t, []int{0}, GetModelQuotaTypes("public-task"))
	encoded, err = json.Marshal(quotes[0])
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"quota_type":0`)
	require.Empty(t, GetModelQuotaTypes("missing-model"))
}

func TestDirectAndExpressionQuotaTypesFollowTheirActiveBaseSchedule(t *testing.T) {
	isolatePricingConfig(t)
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: "quota-direct", Enabled: true,
		BillingType: ModelPricingBillingRequest, RequestPrice: 0.1}))
	quote := Pricing{ModelName: "quota-direct"}
	populateAdvancedPricing(&quote)
	require.Equal(t, 1, quote.QuotaType)
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"billing_setting.billing_mode": `{"quota-direct":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"quota-direct":"tier(\"base\", p * 2)"}`,
	}))
	populateAdvancedPricing(&quote)
	require.Equal(t, 0, quote.QuotaType, "inactive direct per-call prices must not classify the expression's base")
}

func pricingTestRegistry(t *testing.T) *jsplugin.Registry {
	t.Helper()
	previous := jsplugin.DefaultRegistry
	registry := jsplugin.NewRegistry()
	jsplugin.DefaultRegistry = registry
	t.Cleanup(func() { jsplugin.DefaultRegistry = previous; InvalidatePricingCache() })
	for _, spec := range []struct{ key, field, unit string }{{"public-alpha", "seconds", "second"}, {"public-beta", "credits", "credit"}} {
		source := fmt.Sprintf(`
export const meta={apiVersion:1,key:%q,name:%q,version:"1.0.0",author:{name:"test"},models:["public-task"],fetchMode:"per_task",
usageSchema:{%s:{type:"number",unit:%q,description:{en:"Usage",zh:"用量"}}},usageExamples:[{label:"example",facts:{%s:2}}]};
export function buildSubmitRequest(){return {};}
export function parseSubmitResponse(){return {};}
export function buildQueryRequest(){return {};}
export function parseTaskResult(){return {};}`, spec.key, spec.key, spec.field, spec.unit, spec.field)
		_, err := registry.RegisterFactory(source, jsplugin.Options{})
		require.NoError(t, err)
	}
	return registry
}

func TestPublicTaskPricingUsesIndependentProviderSchemasAndPreservesDirectPrecedence(t *testing.T) {
	isolatePricingConfig(t)
	registry := pricingTestRegistry(t)
	base := `tier("base", u("seconds") * 0.05)`
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"billing_setting.billing_mode":          `{"public-task":"tiered_expr"}`,
		"billing_setting.billing_expr":          `{"public-task":` + fmt.Sprintf("%q", base) + `}`,
		billing_setting.PluginBillingExprOption: `{"public-beta::public-task":"tier(\"credit\", u(\"credits\") * 0.2)"}`,
	}))
	quote := Pricing{ModelName: "public-task"}
	populateAdvancedPricing(&quote)
	populatePluginPricing(&quote, registry.Generation())
	require.Len(t, quote.BillingPluginVariants, 2)
	variants := map[string]PricingPluginVariant{}
	for _, variant := range quote.BillingPluginVariants {
		variants[variant.PluginKey] = variant
	}
	require.Equal(t, base, variants["public-alpha"].BillingExpr)
	require.Contains(t, variants["public-beta"].BillingExpr, `u("credits")`)
	require.Equal(t, "credit", variants["public-beta"].BillingUsageSchema["credits"].Unit)
	require.EqualValues(t, 2, variants["public-beta"].BillingUsageExamples[0].Facts["credits"])
	variants["public-alpha"].BillingUsageSchema["seconds"].Description["zh"] = "changed"
	plugin, ok := registry.Generation().Get("public-alpha")
	require.True(t, ok)
	require.Equal(t, "用量", plugin.Meta.UsageSchema["seconds"].Description["zh"])

	// Simulate persisted pricing whose schema became incompatible after a
	// plugin update. It must not become a public quote for that provider.
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{}`}))
	quote = Pricing{ModelName: "public-task"}
	populateAdvancedPricing(&quote)
	populatePluginPricing(&quote, registry.Generation())
	for _, variant := range quote.BillingPluginVariants {
		if variant.PluginKey == "public-beta" {
			require.Empty(t, variant.BillingExpr)
		}
	}

	direct := Pricing{ModelName: "public-task", BillingMode: "direct", RequestPrice: 0.75, Configured: true}
	populatePluginPricing(&direct, registry.Generation())
	require.Empty(t, direct.BillingPluginVariants)
	require.Empty(t, direct.BillingUsageSchema)
	require.Equal(t, 0.75, direct.RequestPrice)
}

func TestPricingCacheRefreshesOnPluginGenerationAndConcurrentInvalidation(t *testing.T) {
	isolatePricingConfig(t)
	registry := pricingTestRegistry(t)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "public-task", Enabled: true}).Error)
	InvalidatePricingCache()
	quotes := GetPricing()
	require.Len(t, quotes, 1)
	require.NotEmpty(t, quotes[0].BillingUsageSchema)
	registry.SetEnabled(false)
	quotes = GetPricing()
	require.Len(t, quotes, 1)
	require.Empty(t, quotes[0].BillingUsageSchema, "disabled plugin metadata must disappear without a TTL wait")
	var workers sync.WaitGroup
	for range 4 {
		workers.Go(func() {
			for range 10 {
				GetPricing()
				GetVendors()
				GetSupportedEndpointMap()
				InvalidatePricingCache()
			}
		})
	}
	workers.Wait()
}

func TestPublicPricingHonorsWildcardConversionAndExactModePrecedence(t *testing.T) {
	isolatePricingConfig(t)
	previousAliases := taskAliasViewPtr.Swap(nil)
	t.Cleanup(func() { taskAliasViewPtr.Store(previousAliases) })
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: "public-wild-*", Enabled: true, InputPrice: 9}))
	const expression = `tier("wild", p * 2)`
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"billing_setting.billing_mode": `{"public-wild-*":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"public-wild-*":` + fmt.Sprintf("%q", expression) + `}`,
	}))
	quote := Pricing{ModelName: "public-wild-one", InputPrice: 9}
	populateAdvancedPricing(&quote)
	require.Equal(t, expression, quote.BillingExpr)
	require.Equal(t, "expression", quote.BillingType)
	require.Zero(t, quote.InputPrice)

	// An exact ratio selection overrides the matching wildcard expression.
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"billing_setting.billing_mode": `{"public-wild-*":"tiered_expr","public-wild-one":"ratio"}`,
		"ModelPrice":                   `{"public-wild-one":0.2}`,
	}))
	quote = Pricing{ModelName: "public-wild-one", InputPrice: 9}
	populateAdvancedPricing(&quote)
	require.Equal(t, "ratio", quote.BillingMode)
	require.Equal(t, float64(0.2), quote.RequestPrice)
}

func TestPricingMutationUsesFreshTaskAliasesWithinItsTransaction(t *testing.T) {
	isolatePricingConfig(t)
	registry := pricingTestRegistry(t)
	_, err := registry.RegisterFactory(`
export const meta={apiVersion:1,key:"cold-billing",name:"Cold",version:"1.0.0",author:{name:"test"},models:["cold-task"],fetchMode:"per_task",usageSchema:{seconds:{type:"number",unit:"second"}}};
export function buildSubmitRequest(){return {};}
export function parseSubmitResponse(){return {};}
export function buildQueryRequest(){return {};}
export function parseTaskResult(){return {};}`, jsplugin.Options{})
	require.NoError(t, err)
	previousAliases := taskAliasViewPtr.Swap(&taskAliasView{
		generation: registry.Generation().Number, expiresAt: time.Now().Add(time.Hour), byFold: map[string]TaskAliasTarget{},
	})
	t.Cleanup(func() { taskAliasViewPtr.Store(previousAliases) })
	mapping := `{"cold-alias":"cold-task"}`
	require.NoError(t, DB.Create(&Channel{Type: constant.ChannelTypeTaskPlugin, Status: common.ChannelStatusEnabled, Models: "cold-alias", ModelMapping: &mapping}).Error)
	const expression = `tier("seconds", u("seconds") * 0.1)`
	require.NoError(t, UpdateOptionsBulk(map[string]string{
		"billing_setting.billing_mode": `{"cold-alias":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"cold-alias":` + fmt.Sprintf("%q", expression) + `}`,
	}))
	stored, exists := billing_setting.GetBillingExpr("cold-alias")
	require.True(t, exists)
	require.Equal(t, expression, stored)
	require.Error(t, UpdateOptionsBulk(map[string]string{
		"billing_setting.billing_expr": `{"cold-alias":"tier(\"bad\", u(\"undeclared\"))"}`,
	}))
	stored, _ = billing_setting.GetBillingExpr("cold-alias")
	require.Equal(t, expression, stored, "invalid schema must roll back the whole price change")
}
