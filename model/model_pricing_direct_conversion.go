package model

import (
	"errors"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/shopspring/decimal"
)

// PreviewDirectModelPricingConversion keeps absolute USD prices intact,
// including independently free cache/media categories and zero input prices.
// It does not change the active schedule; saving requires a versioned change.
func PreviewDirectModelPricingConversion(name string) (*ModelPricingConversion, error) {
	price, ok := GetModelPricing(name)
	if !ok {
		return nil, errors.New("no enabled direct price schedule for this model")
	}
	// Explicit USD lanes do not inherit legacy ratios or OpenRouter cost-derived
	// cache prices. Routing restrictions still apply to their automatic migration.
	route, err := inspectDirectPricingConversionRoute(name, price.BillingType == ModelPricingBillingRequest)
	if err != nil {
		return nil, err
	}
	preview := &ModelPricingConversion{UnsupportedReason: route.UnsupportedReason}
	if route.UnsupportedReason != "" {
		return preview, nil
	}
	if price.BillingType == ModelPricingBillingRequest {
		preview.Expression = `tier("request", fixed(` + decimal.NewFromFloat(price.RequestPrice).String() + `))`
		if route.ImageCount {
			preview.BillingDetails.ImageCount = true
			preview.Expression += ` * image_count`
			for _, rule := range legacyDallePricingRules(name) {
				preview.Expression += ` * (` + rule.Condition + ` ? ` + decimal.NewFromFloat(rule.Multiplier).String() + ` : 1)`
			}
		}
	} else {
		terms := make([]string, 0, 9)
		for _, lane := range []struct {
			variable string
			price    float64
		}{
			{"p", price.InputPrice}, {"c", price.OutputPrice}, {"cr", price.CacheReadPrice},
			{"cc", price.CacheWritePrice}, {"cc1h", price.CacheWritePrice}, {"img", price.ImagePrice},
			{"ai", price.AudioInputPrice}, {"ao", price.AudioOutputPrice},
		} {
			terms = append(terms, lane.variable+" * "+decimal.NewFromFloat(lane.price).String())
		}
		preview.Expression = `tier("direct", ` + strings.Join(terms, " + ") + `)`
	}
	if err := billing_setting.SmokeTestExpr(preview.Expression); err != nil {
		return nil, err
	}
	return preview, nil
}

// A wildcard schedule can cover several settlement paths. Inspect every
// currently registered model to which this row actually applies, preserving
// more specific direct schedules and refusing incompatible image multipliers.
func inspectDirectPricingConversionRoute(name string, fixedPrice bool) (*pricingConversionRoute, error) {
	result, err := inspectModelPricingConversionRoute(name, nil, fixedPrice)
	if err != nil || result.UnsupportedReason != "" || !strings.Contains(name, "*") {
		return result, err
	}
	var candidates []string
	if err := DB.Model(&Ability{}).Distinct().Pluck("model", &candidates).Error; err != nil {
		return nil, err
	}
	for _, plugin := range jsplugin.DefaultRegistry.Generation().Plugins() {
		candidates = append(candidates, plugin.Meta.Models...)
	}
	slices.Sort(candidates)
	for _, candidate := range slices.Compact(candidates) {
		price, exists := GetModelPricing(candidate)
		if !exists || price.ModelName != name || candidate == name {
			continue
		}
		route, err := inspectModelPricingConversionRoute(candidate, nil, fixedPrice)
		if err != nil || route.UnsupportedReason != "" {
			return route, err
		}
		if fixedPrice && !slices.Equal(legacyDallePricingRules(name), legacyDallePricingRules(candidate)) {
			return &pricingConversionRoute{UnsupportedReason: "This wildcard covers different image pricing rules and must be converted manually."}, nil
		}
		result.ImageCount = result.ImageCount || route.ImageCount
	}
	return result, nil
}
