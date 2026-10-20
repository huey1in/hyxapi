package helper

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hostreasoning "github.com/QuantumNous/new-api/setting/reasoning"
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
	if !HasPriceOrRatioEntry(pricingModelName) {
		candidates := hostreasoning.CanonicalBillingModelNames(pricingModelName)
		candidates = append(candidates, hostreasoning.BaseModelName(pricingModelName))
		for _, candidate := range candidates {
			if HasPriceOrRatioEntry(candidate) {
				pricingModelName = candidate
				break
			}
		}
	}
	if normalized := ratio_setting.FormatMatchingModelName(pricingModelName); normalized != pricingModelName && !HasPriceOrRatioEntry(pricingModelName) {
		pricingModelName = normalized
	}
	geminiRequest, isGeminiRequest := info.Request.(*dto.GeminiChatRequest)
	if isGeminiRequest &&
		model_setting.GetGeminiSettings().ThinkingAdapterEnabled &&
		!strings.HasSuffix(pricingModelName, "-nothinking") &&
		geminiRequest.GenerationConfig.ThinkingConfig != nil &&
		geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget != nil &&
		*geminiRequest.GenerationConfig.ThinkingConfig.ThinkingBudget == 0 {
		candidate := pricingModelName + "-nothinking"
		if HasPriceOrRatioEntry(candidate) {
			pricingModelName = candidate
		}
	}

	pricingModelName = model.ResolveModelPricingBillingName(pricingModelName)
	info.PricingModelName = pricingModelName
	return pricingModelName
}

// HandleGroupRatio checks for "auto_group" in the context and updates the group ratio and relayInfo.UsingGroup if present
func HandleGroupRatio(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) types.GroupRatioInfo {
	groupRatioInfo := types.GroupRatioInfo{
		GroupRatio:        1.0, // default ratio
		GroupSpecialRatio: -1,
	}

	// check auto group
	if ctx != nil {
		if autoGroup, exists := ctx.Get("auto_group"); exists {
			if group, ok := autoGroup.(string); ok {
				logger.LogDebug(ctx, "final group: %s", group)
				relayInfo.UsingGroup = group
			}
		}
	}

	// check user group special ratio
	userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(relayInfo.UserGroup, relayInfo.UsingGroup)
	if ok {
		// user group special ratio
		groupRatioInfo.GroupSpecialRatio = userGroupRatio
		groupRatioInfo.GroupRatio = userGroupRatio
		groupRatioInfo.HasSpecialRatio = true
	} else {
		// normal group ratio
		groupRatioInfo.GroupRatio = ratio_setting.GetGroupRatio(relayInfo.UsingGroup)
	}

	return groupRatioInfo
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
	return common.QuotaRound(quota)
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

func tokenMetaContainsFileType(meta *relaytypes.TokenCountMeta, fileType relaytypes.FileType) bool {
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
	meta *relaytypes.TokenCountMeta,
	groupRatio float64,
) int {
	if pricing == nil {
		return 0
	}
	if meta == nil {
		meta = &relaytypes.TokenCountMeta{}
	}

	inputPrice := maxPrice(
		pricing.InputPrice,
		pricing.CacheReadPrice,
		pricing.CacheWritePrice,
	)
	outputPrice := pricing.OutputPrice

	if tokenMetaContainsFileType(meta, relaytypes.FileTypeImage) {
		inputPrice = maxPrice(inputPrice, pricing.ImagePrice)
	}
	if meta.ImagePriceRatio > 0 {
		imagePrice := pricing.ImagePrice * meta.ImagePriceRatio
		inputPrice = maxPrice(inputPrice, imagePrice)
		outputPrice = maxPrice(outputPrice, imagePrice)
	}

	hasAudioInput := tokenMetaContainsFileType(meta, relaytypes.FileTypeAudio)
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
	return common.QuotaRound(quota)
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
	pd.UsePrice = price.BillingType == model.ModelPricingBillingRequest
	pd.ModelPrice = price.RequestPrice
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
func modelPriceHelperDirect(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *relaytypes.TokenCountMeta) (types.PriceData, error) {
	pricingModelName := ResolvePricingModelName(info)
	modelPricing, configured := model.GetModelPricing(pricingModelName)
	if !configured {
		return types.PriceData{}, modelPriceNotConfiguredError(pricingModelName, info.UserId)
	}
	if (info.RelayMode == relayconstant.RelayModeToolsSearch || info.RelayMode == relayconstant.RelayModeToolsFetch) && modelPricing.BillingType != model.ModelPricingBillingRequest {
		return types.PriceData{}, fmt.Errorf("%s requires per-request pricing (recommended USD 0.00075 per request)", pricingModelName)
	}
	groupRatioInfo := HandleGroupRatio(c, info)
	pd := applyDirectSchedule(modelPricing, groupRatioInfo)

	if meta == nil {
		meta = &relaytypes.TokenCountMeta{}
	}
	if modelPricing.BillingType == model.ModelPricingBillingRequest {
		requestPrice := modelPricing.RequestPrice
		if meta.ImagePriceRatio > 0 {
			requestPrice *= meta.ImagePriceRatio
		}
		pd.RequestPrice = requestPrice
		pd.ModelPrice = requestPrice
		pd.QuotaToPreConsume = directRequestQuota(requestPrice, groupRatioInfo.GroupRatio)
		pd.Quota = pd.QuotaToPreConsume
	} else {
		pd.QuotaToPreConsume = conservativeTokenPreConsumeQuota(modelPricing, info, promptTokens, meta, groupRatioInfo.GroupRatio)
	}
	if request, image := info.Request.(*dto.ImageRequest); image {
		count, err := request.ImageCount(false)
		if err != nil {
			return types.PriceData{}, err
		}
		if pd.UsePrice {
			pd.AddOtherRatio("n", float64(count))
			info.ImageQuotaBeforeGroup = pd.RequestPrice * common.QuotaPerUnit
		} else {
			info.ImageQuotaBeforeGroup = float64(conservativeTokenPreConsumeQuota(modelPricing, info, promptTokens, meta, 1))
		}
		quota, err := common.QuotaFromFloatStrict(pd.ApplyOtherRatiosToFloat(info.ImageQuotaBeforeGroup * groupRatioInfo.GroupRatio))
		if err != nil {
			return types.PriceData{}, err
		}
		pd.QuotaToPreConsume = quota
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
func modelPriceHelperPerCallDirect(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, error) {
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

// HasPriceOrRatioEntry is entry detection for billing-name resolution. An
// explicit mode remains authoritative even if its expression is incomplete.
func HasPriceOrRatioEntry(modelName string) bool {
	if ContainsModelPricing(modelName) {
		return true
	}
	if ratio_setting.HasConfiguredModelRatio(modelName) {
		return true
	}
	if _, ok := ratio_setting.GetModelPrice(modelName, false); ok {
		return true
	}
	return billing_setting.GetBillingMode(modelName) == billing_setting.BillingModeTieredExpr
}

// HasModelBillingConfig reports whether discovery can advertise a usable
// configured price. Self-use permission is checked by the caller separately.
func HasModelBillingConfig(modelName string) bool {
	billingName := model.ResolveModelPricingBillingName(modelName)
	if ContainsModelPricing(modelName) {
		if _, explicit := billing_setting.GetConfiguredBillingMode(billingName); !explicit {
			return true
		}
	}
	generation := jsplugin.DefaultRegistry.Generation()
	providers := generation.PluginsByModel(modelName)
	usageModel := modelName
	if len(providers) == 0 {
		if target, ok := model.ResolveTaskModelAlias(generation, modelName); ok {
			if plugin, exists := generation.Get(target.PluginKey); exists {
				providers = []*jsplugin.LoadedPlugin{plugin}
				usageModel = target.Declared
			}
		}
	}
	if len(providers) > 0 {
		for _, plugin := range providers {
			if expression, ok := billing_setting.ResolveTaskBillingExpr(plugin.Meta.Key, modelName, usageModel, billingName); ok {
				schema, _ := plugin.Meta.UsageForModel(usageModel)
				if billing_setting.TaskExprCompatible(expression, schema) {
					return true
				}
			}
		}
		// Ratio providers can still use an explicitly configured per-call price.
		if billing_setting.GetBillingMode(billingName) == billing_setting.BillingModeTieredExpr {
			return false
		}
	}
	if billing_setting.GetBillingMode(billingName) == billing_setting.BillingModeTieredExpr {
		expression, configured := billing_setting.GetBillingExpr(billingName)
		return configured && strings.TrimSpace(expression) != ""
	}
	if _, configured := ratio_setting.GetModelPrice(billingName, false); configured {
		return true
	}
	return ratio_setting.HasConfiguredModelRatio(billingName)
}
