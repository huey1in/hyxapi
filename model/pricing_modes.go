package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// populateAdvancedPricing mirrors relay precedence: an existing direct row
// wins until an administrator explicitly selects an upstream billing mode.
func populateAdvancedPricing(pricing *Pricing) {
	name := ResolveModelPricingBillingName(pricing.ModelName)
	pricing.QuotaType = 0
	if direct, ok := GetModelPricing(pricing.ModelName); ok {
		if _, explicit := billing_setting.GetConfiguredBillingMode(name); !explicit {
			pricing.BillingMode = "direct"
			if direct.BillingTypeName() == "request" {
				pricing.QuotaType = 1
			}
			return
		}
	}
	// Keep the base schedule's unit even when a provider expression overlays
	// the displayed mode. Other providers may still use the base per-call price.
	requestPrice, perRequest := ratio_setting.GetModelPrice(name, false)
	if perRequest {
		pricing.QuotaType = 1
	}
	if billing_setting.GetBillingMode(name) == billing_setting.BillingModeTieredExpr {
		pricing.BillingMode = billing_setting.BillingModeTieredExpr
		pricing.BillingType = "expression"
		pricing.BillingExpr, _ = billing_setting.GetBillingExpr(name)
		pricing.Configured = pricing.BillingExpr != ""
		// Clear the inactive direct price rather than displaying it as a quote.
		pricing.InputPrice, pricing.OutputPrice, pricing.CacheReadPrice, pricing.CacheWritePrice = 0, 0, 0, 0
		pricing.ImagePrice, pricing.AudioInputPrice, pricing.AudioOutputPrice, pricing.RequestPrice = 0, 0, 0, 0
		return
	}
	pricing.BillingMode = billing_setting.BillingModeRatio
	if perRequest {
		pricing.BillingType, pricing.Configured, pricing.RequestPrice = "request", true, requestPrice
		return
	}
	ratio, configured, _ := ratio_setting.GetModelRatio(name)
	pricing.Configured = configured
	if !configured || common.QuotaPerUnit <= 0 {
		return
	}
	pricing.BillingType = "tokens"
	pricing.InputPrice = ratio * 1_000_000 / common.QuotaPerUnit
	pricing.OutputPrice = pricing.InputPrice * ratio_setting.GetCompletionRatio(name)
	cache, _ := ratio_setting.GetCacheRatio(name)
	write, _ := ratio_setting.GetCreateCacheRatio(name)
	image, _ := ratio_setting.GetImageRatio(name)
	pricing.CacheReadPrice = pricing.InputPrice * cache
	pricing.CacheWritePrice = pricing.InputPrice * write
	pricing.ImagePrice = pricing.InputPrice * image
	pricing.AudioInputPrice = pricing.InputPrice * ratio_setting.GetAudioRatio(name)
	pricing.AudioOutputPrice = pricing.AudioInputPrice * ratio_setting.GetAudioCompletionRatio(name)
}

// ResolveModelPricingBillingName applies an exact model's explicit mode before
// an explicit conversion on its matching direct-price rule. Without either,
// the original model keeps its legacy direct-price priority.
func ResolveModelPricingBillingName(name string) string {
	if _, explicit := billing_setting.GetConfiguredBillingMode(name); explicit {
		return name
	}
	if direct, exists := GetModelPricing(name); exists {
		if _, explicit := billing_setting.GetConfiguredBillingMode(direct.ModelName); explicit {
			return direct.ModelName
		}
	}
	return name
}

// Use the executing provider's schema and expression, just as task submission
// does. Never expose dormant plugin overrides over an active direct USD row.
func populatePluginPricing(pricing *Pricing, generation *jsplugin.RoutingGeneration) {
	if generation == nil || pricing.BillingMode == "direct" {
		return
	}
	name, usageModel := pricing.ModelName, pricing.ModelName
	billingName := ResolveModelPricingBillingName(name)
	plugin, found := generation.GetByModel(name)
	if !found {
		if target, resolved := ResolveTaskModelAlias(generation, name); resolved {
			plugin, found = generation.Get(target.PluginKey)
			usageModel = target.Declared
		}
	}
	if found && plugin != nil {
		schema, examples := plugin.Meta.UsageForModel(usageModel)
		pricing.BillingUsageSchema = jsplugin.CloneUsageSchema(schema)
		pricing.BillingUsageExamples = jsplugin.CloneUsageExamples(examples)
		if expression, configured := billing_setting.ResolveTaskBillingExpr(plugin.Meta.Key, name, usageModel, billingName); configured {
			pricing.BillingMode, pricing.BillingType = billing_setting.BillingModeTieredExpr, "expression"
			pricing.BillingExpr = expression
			pricing.Configured = billing_setting.TaskExprCompatible(expression, schema)
		}
	}
	providers := generation.PluginsByModel(name)
	hasOverride := false
	for _, provider := range providers {
		if _, configured := billing_setting.GetPluginBillingExpr(provider.Meta.Key, name); configured {
			hasOverride = true
			break
		}
	}
	if !hasOverride && (len(providers) < 2 || pricing.BillingMode != billing_setting.BillingModeTieredExpr) {
		return
	}
	for _, provider := range providers {
		schema, examples := provider.Meta.UsageForModel(name)
		if schema == nil {
			schema = map[string]jsplugin.UsageFieldSchema{}
		}
		expression, configured := billing_setting.ResolveTaskBillingExpr(provider.Meta.Key, name, "", billingName)
		mode := billing_setting.BillingModeRatio
		if configured || billing_setting.GetBillingMode(billingName) == billing_setting.BillingModeTieredExpr {
			mode = billing_setting.BillingModeTieredExpr
		}
		if mode == billing_setting.BillingModeTieredExpr && !billing_setting.TaskExprCompatible(expression, schema) {
			expression = ""
		}
		pricing.BillingPluginVariants = append(pricing.BillingPluginVariants, PricingPluginVariant{
			PluginKey: provider.Meta.Key, PluginName: provider.Meta.Name, Icon: provider.Meta.Icon,
			BillingMode: mode, BillingExpr: expression,
			BillingUsageSchema: jsplugin.CloneUsageSchema(schema), BillingUsageExamples: jsplugin.CloneUsageExamples(examples),
		})
		if mode == billing_setting.BillingModeTieredExpr && expression != "" {
			pricing.Configured = true
		}
	}
}
