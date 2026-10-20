package helper

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// Existing direct schedules retain their prices until an administrator chooses
// a billing mode explicitly. Newly configured models follow upstream defaults.
func ModelPriceHelper(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) (hosttypes.PriceData, error) {
	name := ResolvePricingModelName(info)
	mode, explicit := billing_setting.GetConfiguredBillingMode(name)
	_, direct := model.GetModelPricing(name)
	if direct && !explicit {
		return modelPriceHelperDirect(c, info, promptTokens, meta)
	}
	if mode == billing_setting.BillingModeTieredExpr || !explicit && billing_setting.GetBillingMode(name) == billing_setting.BillingModeTieredExpr {
		return modelPriceHelperTiered(c, info, name, promptTokens, HandleGroupRatio(c, info))
	}
	if meta == nil {
		meta = &types.TokenCountMeta{}
	}
	price, err := modelPriceHelperRatio(c, info, promptTokens, meta)
	if err != nil {
		return price, err
	}
	price, err = directFieldsFromRatios(price)
	info.PriceData = price
	return price, err
}

func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (hosttypes.PriceData, error) {
	name := ResolvePricingModelName(info)
	_, explicit := billing_setting.GetConfiguredBillingMode(name)
	if _, direct := model.GetModelPricing(name); direct && !explicit {
		return modelPriceHelperPerCallDirect(c, info)
	}
	if billing_setting.GetBillingMode(name) == billing_setting.BillingModeTieredExpr {
		price, err := modelPriceHelperTiered(c, info, name, 0, HandleGroupRatio(c, info))
		price.Quota = price.QuotaToPreConsume
		info.PriceData = price
		return price, err
	}
	price, err := modelPriceHelperPerCallRatio(c, info)
	if err != nil {
		return price, err
	}
	price, err = directFieldsFromRatios(price)
	info.PriceData = price
	return price, err
}

// Translate ratio schedules into the existing absolute-price settlement inputs;
// conversion uses the current quota unit rather than assuming its default.
func directFieldsFromRatios(price hosttypes.PriceData) (hosttypes.PriceData, error) {
	if common.QuotaPerUnit <= 0 || math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) {
		return price, fmt.Errorf("invalid quota unit")
	}
	price.BillingMode = billing_setting.BillingModeRatio
	price.Configured = true
	if price.UsePrice {
		price.BillingType = model.ModelPricingBillingRequest
		price.RequestPrice = price.ModelPrice
		return price, nil
	}
	base := price.ModelRatio * 1_000_000 / common.QuotaPerUnit
	price.InputPrice = base
	price.OutputPrice = base * price.CompletionRatio
	price.CacheReadPrice = base * price.CacheRatio
	price.CacheWritePrice = base * price.CacheCreationRatio
	price.CacheWrite5mPrice = base * price.CacheCreation5mRatio
	price.CacheWrite1hPrice = base * price.CacheCreation1hRatio
	price.ImagePrice = base * price.ImageRatio
	price.AudioInputPrice = base * price.AudioRatio
	price.AudioOutputPrice = price.AudioInputPrice * price.AudioCompletionRatio
	return price, nil
}
