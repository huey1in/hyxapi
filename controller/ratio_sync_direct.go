package controller

import (
	"maps"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

// Export absolute schedules as expressions, preserving independently free
// media/cache lanes and a zero input price. Never publish dormant legacy ratios
// for a direct schedule that cannot be represented on the receiving instance.
func overlayDirectPricingSyncData(data map[string]any) (map[string]any, error) {
	for _, field := range pricingSyncFields {
		data[field] = maps.Clone(valueMap(data[field]))
		if data[field] == nil || valueMap(data[field]) == nil {
			data[field] = map[string]any{}
		}
	}
	if model.DB == nil { // Pure protocol tests do not initialize persistence.
		return data, nil
	}
	rows, err := model.ListModelPricings(false)
	if err != nil {
		return nil, err
	}
	direct := map[string]any{}
	unavailable := map[string]string{}
	for _, row := range rows {
		if !row.Enabled {
			continue
		}
		if _, explicit := billing_setting.GetConfiguredBillingMode(row.ModelName); explicit {
			continue
		}
		for _, field := range pricingSyncFields {
			delete(valueMap(data[field]), row.ModelName)
		}
		preview, err := model.PreviewDirectModelPricingConversion(row.ModelName)
		if err != nil {
			return nil, err
		}
		if preview.UnsupportedReason != "" {
			unavailable[row.ModelName] = preview.UnsupportedReason
			continue
		}
		valueMap(data[billing_setting.BillingModeField])[row.ModelName] = billing_setting.BillingModeTieredExpr
		valueMap(data[billing_setting.BillingExprField])[row.ModelName] = preview.Expression
		direct[row.ModelName] = true
	}
	data["direct_models"] = direct
	data["export_errors"] = unavailable
	return data, nil
}
