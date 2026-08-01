package helper

import (
	"fmt"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const tokenPriceUnit = 1_000_000.0

func modelPriceNotConfiguredError(modelName string, userId int) error {
	if model.IsAdmin(userId) {
		return fmt.Errorf(
			"模型 %s 的价格未配置。请前往「模型价格」中为该模型配置价格；"+
				"Model %s price not configured. Configure the model price in Model Pricing.",
			modelName, modelName,
		)
	}
	return fmt.Errorf(
		"模型 %s 的价格尚未由管理员配置，暂时无法使用，请联系站点管理员开启该模型；"+
			"Model %s has not been priced by the administrator yet. Please contact the site administrator to enable this model.",
		modelName, modelName,
	)
}

// ResolvePricingModelName selects the price row once per request. Gemini's
// explicit zero thinking budget can use a separately priced -nothinking model,
// while OriginModelName remains unchanged until the relay adapter runs.
func ResolvePricingModelName(info *relaycommon.RelayInfo) string {
	if info == nil {
		return ""
	}
	if info.PricingModelName != "" {
		return info.PricingModelName
	}

	pricingModelName := info.OriginModelName
	geminiRequest, isGeminiRequest := info.Request.(*dto.GeminiChatRequest)
	if isGeminiRequest &&
		model_setting.GetGeminiSettings().ThinkingAdapterEnabled &&
		!strings.HasSuffix(pricingModelName, "-nothinking") &&
		geminiRequest.GenerationConfig.ThinkingConfig != nil &&
		geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget != nil &&
		*geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget == 0 {
		candidate := pricingModelName + "-nothinking"
		if ContainsModelPricing(candidate) {
			pricingModelName = candidate
		}
	}

	info.PricingModelName = pricingModelName
	return pricingModelName
}

// HandleGroupRatio returns the group multiplier. Group pricing remains a
// separate setting; model pricing rows contain only the provider's original
// USD prices.
func HandleGroupRatio(_ *gin.Context, relayInfo *relaycommon.RelayInfo) types.GroupRatioInfo {
	return types.GroupRatioInfo{
		GroupRatio: ratio_setting.GetGroupRatio(relayInfo.UsingGroup),
	}
}

func directTokenQuota(inputPrice, outputPrice float64, inputTokens, outputTokens int, groupRatio float64) int {
	if inputTokens <= 0 && outputTokens <= 0 {
		return 0
	}
	usd := (float64(inputTokens)*inputPrice + float64(outputTokens)*outputPrice) / tokenPriceUnit
	if usd <= 0 || groupRatio <= 0 {
		return 0
	}
	quota := usd * common.QuotaPerUnit * groupRatio
	if quota > 0 && quota < 1 {
		return 1
	}
	return int(math.Round(quota))
}

func maxPrice(prices ...float64) float64 {
	max := 0.0
	for _, price := range prices {
		if price > max {
			max = price
		}
	}
	return max
}

func highestTokenPrice(pricing *model.ModelPricing) float64 {
	if pricing == nil {
		return 0
	}
	return maxPrice(
		pricing.InputPrice,
		pricing.OutputPrice,
		pricing.CacheReadPrice,
		pricing.CacheWritePrice,
		pricing.ImagePrice,
		pricing.AudioInputPrice,
		pricing.AudioOutputPrice,
	)
}

func shouldSkipDirectFreeModelPreConsume(pricing *model.ModelPricing, groupRatio float64) bool {
	if pricing == nil || operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		return false
	}
	if groupRatio == 0 {
		return true
	}
	if pricing.BillingType == model.ModelPricingBillingRequest {
		return pricing.RequestPrice == 0
	}
	return highestTokenPrice(pricing) == 0
}

func tokenMetaContainsFileType(meta *types.TokenCountMeta, fileType types.FileType) bool {
	if meta == nil {
		return false
	}
	for _, file := range meta.Files {
		if file != nil && file.FileType == fileType {
			return true
		}
	}
	return false
}

// conservativeTokenPreConsumeQuota reserves enough quota for the most
// expensive known interpretation of input/output tokens. Exact token classes
// are only available after the upstream returns usage, so cache and known
// media prices must be considered here and reconciled during settlement.
func conservativeTokenPreConsumeQuota(
	pricing *model.ModelPricing,
	info *relaycommon.RelayInfo,
	promptTokens int,
	meta *types.TokenCountMeta,
	groupRatio float64,
) int {
	if pricing == nil {
		return 0
	}
	if meta == nil {
		meta = &types.TokenCountMeta{}
	}

	inputPrice := maxPrice(
		pricing.InputPrice,
		pricing.CacheReadPrice,
		pricing.CacheWritePrice,
	)
	outputPrice := pricing.OutputPrice

	if tokenMetaContainsFileType(meta, types.FileTypeImage) {
		inputPrice = maxPrice(inputPrice, pricing.ImagePrice)
	}
	if meta.ImagePriceRatio > 0 {
		imagePrice := pricing.ImagePrice * meta.ImagePriceRatio
		inputPrice = maxPrice(inputPrice, imagePrice)
		outputPrice = maxPrice(outputPrice, imagePrice)
	}

	hasAudioInput := tokenMetaContainsFileType(meta, types.FileTypeAudio)
	hasAudioOutput := hasAudioInput
	if info != nil {
		hasAudioInput = hasAudioInput || info.InputAudioFormat != "" || info.AudioUsage
		hasAudioOutput = hasAudioOutput || info.OutputAudioFormat != "" || info.AudioUsage
	}
	if hasAudioInput {
		inputPrice = maxPrice(inputPrice, pricing.AudioInputPrice)
	}
	if hasAudioOutput {
		outputPrice = maxPrice(outputPrice, pricing.AudioOutputPrice)
	}

	inputTokens := common.Max(promptTokens, common.PreConsumedQuota)
	return directTokenQuota(inputPrice, outputPrice, inputTokens, meta.MaxTokens, groupRatio)
}

func conservativePerCallTokenPreConsumeQuota(pricing *model.ModelPricing, groupRatio float64) int {
	return directTokenQuota(highestTokenPrice(pricing), 0, common.PreConsumedQuota, 0, groupRatio)
}

func directRequestQuota(requestPrice, groupRatio float64) int {
	if requestPrice <= 0 || groupRatio <= 0 {
		return 0
	}
	quota := requestPrice * common.QuotaPerUnit * groupRatio
	if quota > 0 && quota < 1 {
		return 1
	}
	return int(math.Round(quota))
}

func applyDirectSchedule(price *model.ModelPricing, groupRatioInfo types.GroupRatioInfo) types.PriceData {
	pd := types.PriceData{
		Configured:     price != nil,
		BillingType:    model.ModelPricingBillingToken,
		GroupRatioInfo: groupRatioInfo,
	}
	if price == nil {
		return pd
	}
	pd.BillingType = price.BillingType
	pd.InputPrice = price.InputPrice
	pd.OutputPrice = price.OutputPrice
	pd.CacheReadPrice = price.CacheReadPrice
	pd.CacheWritePrice = price.CacheWritePrice
	pd.ImagePrice = price.ImagePrice
	pd.AudioInputPrice = price.AudioInputPrice
	pd.AudioOutputPrice = price.AudioOutputPrice
	pd.RequestPrice = price.RequestPrice
	return pd
}

// ModelPriceHelper computes the request pre-consumption amount from the
// direct model schedule. Token prices are USD per million tokens and request
// prices are USD per request; the selected group multiplier is applied once.
func ModelPriceHelper(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) (types.PriceData, error) {
	pricingModelName := ResolvePricingModelName(info)
	modelPricing, configured := model.GetModelPricing(pricingModelName)
	if !configured {
		return types.PriceData{}, modelPriceNotConfiguredError(pricingModelName, info.UserId)
	}
	groupRatioInfo := HandleGroupRatio(c, info)
	pd := applyDirectSchedule(modelPricing, groupRatioInfo)

	if meta == nil {
		meta = &types.TokenCountMeta{}
	}
	if modelPricing.BillingType == model.ModelPricingBillingRequest {
		requestPrice := modelPricing.RequestPrice
		if meta.ImagePriceRatio > 0 {
			requestPrice *= meta.ImagePriceRatio
		}
		pd.RequestPrice = requestPrice
		pd.QuotaToPreConsume = directRequestQuota(requestPrice, groupRatioInfo.GroupRatio)
		pd.Quota = pd.QuotaToPreConsume
	} else {
		pd.QuotaToPreConsume = conservativeTokenPreConsumeQuota(modelPricing, info, promptTokens, meta, groupRatioInfo.GroupRatio)
	}
	pd.FreeModel = shouldSkipDirectFreeModelPreConsume(modelPricing, groupRatioInfo.GroupRatio)
	if pd.FreeModel {
		pd.QuotaToPreConsume = 0
		pd.Quota = 0
	}

	info.PriceData = pd
	if common.DebugEnabled {
		println(fmt.Sprintf("model_price_helper result: %s", pd.ToSetting()))
	}
	return pd, nil
}

// ModelPriceHelperPerCall computes the amount used by asynchronous task and
// image endpoints that bill once at submission time. Token schedules use a
// conservative input-token reservation and are reconciled later when usage is
// available; request schedules use their fixed request price.
func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, error) {
	pricingModelName := ResolvePricingModelName(info)
	modelPricing, configured := model.GetModelPricing(pricingModelName)
	if !configured {
		return types.PriceData{}, modelPriceNotConfiguredError(pricingModelName, info.UserId)
	}
	groupRatioInfo := HandleGroupRatio(c, info)
	pd := applyDirectSchedule(modelPricing, groupRatioInfo)

	if modelPricing.BillingType == model.ModelPricingBillingRequest {
		pd.Quota = directRequestQuota(modelPricing.RequestPrice, groupRatioInfo.GroupRatio)
		pd.QuotaToPreConsume = pd.Quota
	} else {
		pd.Quota = conservativePerCallTokenPreConsumeQuota(modelPricing, groupRatioInfo.GroupRatio)
		pd.QuotaToPreConsume = pd.Quota
	}
	pd.FreeModel = shouldSkipDirectFreeModelPreConsume(modelPricing, groupRatioInfo.GroupRatio)
	if pd.FreeModel {
		pd.Quota = 0
		pd.QuotaToPreConsume = 0
	}
	info.PriceData = pd
	return pd, nil
}

func ContainsModelPricing(modelName string) bool {
	_, ok := model.GetModelPricing(modelName)
	return ok
}
