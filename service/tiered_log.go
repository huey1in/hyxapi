package service

import (
	"encoding/base64"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func InjectTieredBillingInfo(other map[string]any, relayInfo *relaycommon.RelayInfo, result *billingexpr.TieredResult) {
	if relayInfo == nil || other == nil {
		return
	}
	snap := relayInfo.TieredBillingSnapshot
	if snap == nil {
		return
	}
	other["billing_mode"] = "tiered_expr"
	other["expr_b64"] = base64.StdEncoding.EncodeToString([]byte(snap.ExprString))
	if result != nil {
		if tokens := result.BillingTokens; tokens != nil && result.BillingUnit == billingexpr.BillingUnitToken {
			other["image_cache_tokens"] = tokens.ImgCR
			other["billing_tokens"] = map[string]float64{
				"p": tokens.P, "c": tokens.C, "len": tokens.Len,
				"cr": tokens.CR, "cc": tokens.CC, "cc1h": tokens.CC1h,
				"img": tokens.Img, "img_cr": tokens.ImgCR, "img_o": tokens.ImgO,
				"ai": tokens.AI, "ao": tokens.AO,
			}
		}
		if result.ImageCount != nil {
			other["image_count"] = *result.ImageCount
		}
		other["matched_tier"] = result.MatchedTier
		if result.BillingUnit != "" {
			other["billing_unit"] = result.BillingUnit
		}
		if result.FixedPrice != nil {
			other["fixed_price"] = *result.FixedPrice
		}
		if len(result.RequestRules) > 0 {
			other["request_rules"] = result.RequestRules
		}
	} else if snap.EstimatedBillingUnit != "" {
		if snap.EstimatedImageCount != nil {
			other["image_count"] = *snap.EstimatedImageCount
		}
		other["matched_tier"] = snap.EstimatedTier
		other["billing_unit"] = snap.EstimatedBillingUnit
		if snap.EstimatedFixedPrice != nil {
			other["fixed_price"] = *snap.EstimatedFixedPrice
		}
	}
}
