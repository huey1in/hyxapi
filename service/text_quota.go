package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type textQuotaSummary struct {
	PromptTokens             int
	CompletionTokens         int
	TotalTokens              int
	CacheTokens              int
	CacheCreationTokens      int
	CacheCreationTokens5m    int
	CacheCreationTokens1h    int
	ImageTokens              int
	AudioTokens              int
	AudioOutputTokens        int
	ModelName                string
	TokenName                string
	UseTimeSeconds           int64
	GroupRatio               float64
	Quota                    int
	IsClaudeUsageSemantic    bool
	UsageSemantic            string
	WebSearchPrice           float64
	WebSearchCallCount       int
	ClaudeWebSearchPrice     float64
	ClaudeWebSearchCallCount int
	FileSearchPrice          float64
	FileSearchCallCount      int
	ImageGenerationCallPrice float64
	BillingType              int
	InputPrice               float64
	OutputPrice              float64
	CacheReadPrice           float64
	CacheWritePrice          float64
	ImagePrice               float64
	AudioInputPrice          float64
	AudioOutputPrice         float64
	RequestPrice             float64
}

func cacheWriteTokensTotal(summary textQuotaSummary) int {
	if summary.CacheCreationTokens5m > 0 || summary.CacheCreationTokens1h > 0 {
		splitCacheWriteTokens := summary.CacheCreationTokens5m + summary.CacheCreationTokens1h
		if summary.CacheCreationTokens > splitCacheWriteTokens {
			return summary.CacheCreationTokens
		}
		return splitCacheWriteTokens
	}
	return summary.CacheCreationTokens
}

func (summary textQuotaSummary) hasBillableUsage() bool {
	return summary.BillingType == model.ModelPricingBillingRequest ||
		summary.TotalTokens > 0 || summary.CacheTokens > 0 ||
		summary.CacheCreationTokens > 0 || summary.ImageTokens > 0 ||
		summary.AudioTokens > 0 || summary.AudioOutputTokens > 0 ||
		summary.WebSearchCallCount > 0 || summary.ClaudeWebSearchCallCount > 0 ||
		summary.FileSearchCallCount > 0 || summary.ImageGenerationCallPrice > 0
}

func calculateTextQuotaSummary(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage) textQuotaSummary {
	summary := textQuotaSummary{
		ModelName:        relayInfo.OriginModelName,
		TokenName:        ctx.GetString("token_name"),
		UseTimeSeconds:   time.Now().Unix() - relayInfo.StartTime.Unix(),
		GroupRatio:       relayInfo.PriceData.GroupRatioInfo.GroupRatio,
		UsageSemantic:    usageSemanticFromUsage(relayInfo, usage),
		BillingType:      relayInfo.PriceData.BillingType,
		InputPrice:       relayInfo.PriceData.InputPrice,
		OutputPrice:      relayInfo.PriceData.OutputPrice,
		CacheReadPrice:   relayInfo.PriceData.CacheReadPrice,
		CacheWritePrice:  relayInfo.PriceData.CacheWritePrice,
		ImagePrice:       relayInfo.PriceData.ImagePrice,
		AudioInputPrice:  relayInfo.PriceData.AudioInputPrice,
		AudioOutputPrice: relayInfo.PriceData.AudioOutputPrice,
		RequestPrice:     relayInfo.PriceData.RequestPrice,
	}
	summary.IsClaudeUsageSemantic = summary.UsageSemantic == "anthropic"

	if usage == nil {
		usage = &dto.Usage{
			PromptTokens:     relayInfo.GetEstimatePromptTokens(),
			CompletionTokens: 0,
			TotalTokens:      relayInfo.GetEstimatePromptTokens(),
		}
	}
	summary.PromptTokens = usage.PromptTokens
	summary.CompletionTokens = usage.CompletionTokens
	summary.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	summary.CacheTokens = usage.PromptTokensDetails.CachedTokens
	summary.CacheCreationTokens = usage.PromptTokensDetails.CachedCreationTokens
	summary.CacheCreationTokens5m = usage.ClaudeCacheCreation5mTokens
	summary.CacheCreationTokens1h = usage.ClaudeCacheCreation1hTokens
	summary.CacheCreationTokens = cacheWriteTokensTotal(summary)
	summary.ImageTokens = usage.PromptTokensDetails.ImageTokens
	summary.AudioTokens = usage.PromptTokensDetails.AudioTokens
	summary.AudioOutputTokens = usage.CompletionTokenDetails.AudioTokens

	groupRatio := decimal.NewFromFloat(summary.GroupRatio)
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	perMillion := decimal.NewFromInt(1_000_000)

	// Built-in tools and image generation are independent USD add-ons.
	toolQuota := decimal.Zero
	if relayInfo.ResponsesUsageInfo != nil {
		if tool, ok := relayInfo.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview]; ok && tool != nil && tool.CallCount > 0 {
			summary.WebSearchCallCount = tool.CallCount
			summary.WebSearchPrice = operation_setting.GetWebSearchPricePerThousand(summary.ModelName, tool.SearchContextSize)
			toolQuota = toolQuota.Add(decimal.NewFromFloat(summary.WebSearchPrice).Mul(decimal.NewFromInt(int64(tool.CallCount))).Div(decimal.NewFromInt(1000)))
		}
		if tool, ok := relayInfo.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolFileSearch]; ok && tool != nil && tool.CallCount > 0 {
			summary.FileSearchCallCount = tool.CallCount
			summary.FileSearchPrice = operation_setting.GetFileSearchPricePerThousand()
			toolQuota = toolQuota.Add(decimal.NewFromFloat(summary.FileSearchPrice).Mul(decimal.NewFromInt(int64(tool.CallCount))).Div(decimal.NewFromInt(1000)))
		}
	} else if strings.HasSuffix(summary.ModelName, "search-preview") {
		searchContextSize := ctx.GetString("chat_completion_web_search_context_size")
		if searchContextSize == "" {
			searchContextSize = "medium"
		}
		summary.WebSearchCallCount = 1
		summary.WebSearchPrice = operation_setting.GetWebSearchPricePerThousand(summary.ModelName, searchContextSize)
		toolQuota = toolQuota.Add(decimal.NewFromFloat(summary.WebSearchPrice).Div(decimal.NewFromInt(1000)))
	}
	summary.ClaudeWebSearchCallCount = ctx.GetInt("claude_web_search_requests")
	if summary.ClaudeWebSearchCallCount > 0 {
		summary.ClaudeWebSearchPrice = operation_setting.GetClaudeWebSearchPricePerThousand()
		toolQuota = toolQuota.Add(decimal.NewFromFloat(summary.ClaudeWebSearchPrice).Mul(decimal.NewFromInt(int64(summary.ClaudeWebSearchCallCount))).Div(decimal.NewFromInt(1000)))
	}
	if ctx.GetBool("image_generation_call") {
		summary.ImageGenerationCallPrice = operation_setting.GetGPTImage1PriceOnceCall(ctx.GetString("image_generation_call_quality"), ctx.GetString("image_generation_call_size"))
		toolQuota = toolQuota.Add(decimal.NewFromFloat(summary.ImageGenerationCallPrice))
	}
	toolQuota = toolQuota.Mul(groupRatio).Mul(quotaPerUnit)

	var directUSD decimal.Decimal
	if summary.BillingType == model.ModelPricingBillingRequest {
		directUSD = decimal.NewFromFloat(summary.RequestPrice)
	} else {
		baseTokens := summary.PromptTokens
		// OpenAI usage includes cache reads/writes in prompt_tokens. Anthropic
		// reports input_tokens and cache classes independently.
		if !summary.IsClaudeUsageSemantic {
			baseTokens -= summary.CacheTokens + summary.CacheCreationTokens
		}
		baseTokens -= summary.ImageTokens + summary.AudioTokens
		if baseTokens < 0 {
			baseTokens = 0
		}
		completionTextTokens := summary.CompletionTokens - summary.AudioOutputTokens
		if completionTextTokens < 0 {
			completionTextTokens = 0
		}
		directUSD = directUSD.Add(decimal.NewFromInt(int64(baseTokens)).Mul(decimal.NewFromFloat(summary.InputPrice)).Div(perMillion))
		directUSD = directUSD.Add(decimal.NewFromInt(int64(summary.CacheTokens)).Mul(decimal.NewFromFloat(summary.CacheReadPrice)).Div(perMillion))
		directUSD = directUSD.Add(decimal.NewFromInt(int64(summary.CacheCreationTokens)).Mul(decimal.NewFromFloat(summary.CacheWritePrice)).Div(perMillion))
		directUSD = directUSD.Add(decimal.NewFromInt(int64(summary.ImageTokens)).Mul(decimal.NewFromFloat(summary.ImagePrice)).Div(perMillion))
		directUSD = directUSD.Add(decimal.NewFromInt(int64(summary.AudioTokens)).Mul(decimal.NewFromFloat(summary.AudioInputPrice)).Div(perMillion))
		directUSD = directUSD.Add(decimal.NewFromInt(int64(completionTextTokens)).Mul(decimal.NewFromFloat(summary.OutputPrice)).Div(perMillion))
		directUSD = directUSD.Add(decimal.NewFromInt(int64(summary.AudioOutputTokens)).Mul(decimal.NewFromFloat(summary.AudioOutputPrice)).Div(perMillion))
	}
	quota := directUSD.Mul(groupRatio).Mul(quotaPerUnit).Add(toolQuota)
	for _, multiplier := range relayInfo.PriceData.OtherRatios() {
		if multiplier > 0 {
			quota = quota.Mul(decimal.NewFromFloat(multiplier))
		}
	}
	summary.Quota = int(quota.Round(0).IntPart())
	if !summary.hasBillableUsage() && toolQuota.IsZero() {
		summary.Quota = 0
	} else if summary.Quota == 0 && quota.GreaterThan(decimal.Zero) {
		summary.Quota = 1
	}
	return summary
}

func usageSemanticFromUsage(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) string {
	if usage != nil && usage.UsageSemantic != "" {
		return usage.UsageSemantic
	}
	if relayInfo != nil && relayInfo.GetFinalRequestRelayFormat() == types.RelayFormatClaude {
		return "anthropic"
	}
	return "openai"
}

func PostTextConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, extraContent []string) {
	originUsage := usage
	if usage == nil {
		extraContent = append(extraContent, "上游无计费信息")
	}
	if originUsage != nil {
		ObserveChannelAffinityUsageCacheByRelayFormat(ctx, usage, relayInfo.GetFinalRequestRelayFormat())
	}

	adminRejectReason := common.GetContextKeyString(ctx, constant.ContextKeyAdminRejectReason)
	summary := calculateTextQuotaSummary(ctx, relayInfo, usage)

	if summary.WebSearchCallCount > 0 {
		extraContent = append(extraContent, fmt.Sprintf("Web Search 调用 %d 次，调用花费 %s", summary.WebSearchCallCount, decimal.NewFromFloat(summary.WebSearchPrice).Mul(decimal.NewFromInt(int64(summary.WebSearchCallCount))).Div(decimal.NewFromInt(1000)).Mul(decimal.NewFromFloat(summary.GroupRatio)).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).String()))
	}
	if summary.ClaudeWebSearchCallCount > 0 {
		extraContent = append(extraContent, fmt.Sprintf("Claude Web Search 调用 %d 次，调用花费 %s", summary.ClaudeWebSearchCallCount, decimal.NewFromFloat(summary.ClaudeWebSearchPrice).Div(decimal.NewFromInt(1000)).Mul(decimal.NewFromFloat(summary.GroupRatio)).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).Mul(decimal.NewFromInt(int64(summary.ClaudeWebSearchCallCount))).String()))
	}
	if summary.FileSearchCallCount > 0 {
		extraContent = append(extraContent, fmt.Sprintf("File Search 调用 %d 次，调用花费 %s", summary.FileSearchCallCount, decimal.NewFromFloat(summary.FileSearchPrice).Mul(decimal.NewFromInt(int64(summary.FileSearchCallCount))).Div(decimal.NewFromInt(1000)).Mul(decimal.NewFromFloat(summary.GroupRatio)).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).String()))
	}
	if summary.AudioInputPrice > 0 && summary.AudioTokens > 0 {
		extraContent = append(extraContent, fmt.Sprintf("Audio Input 花费 %s", decimal.NewFromFloat(summary.AudioInputPrice).Div(decimal.NewFromInt(1000000)).Mul(decimal.NewFromInt(int64(summary.AudioTokens))).Mul(decimal.NewFromFloat(summary.GroupRatio)).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).String()))
	}
	if summary.ImageGenerationCallPrice > 0 {
		extraContent = append(extraContent, fmt.Sprintf("Image Generation Call 花费 %s", decimal.NewFromFloat(summary.ImageGenerationCallPrice).Mul(decimal.NewFromFloat(summary.GroupRatio)).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).String()))
	}

	if !summary.hasBillableUsage() {
		extraContent = append(extraContent, "上游没有返回计费信息，无法扣费（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, summary.ModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, summary.Quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, summary.Quota)
	}

	if err := SettleBilling(ctx, relayInfo, summary.Quota); err != nil {
		logger.LogError(ctx, "error settling billing: "+err.Error())
	}

	logModel := summary.ModelName
	if strings.HasPrefix(logModel, "gpt-4-gizmo") {
		logModel = "gpt-4-gizmo-*"
		extraContent = append(extraContent, fmt.Sprintf("模型 %s", summary.ModelName))
	}
	if strings.HasPrefix(logModel, "gpt-4o-gizmo") {
		logModel = "gpt-4o-gizmo-*"
		extraContent = append(extraContent, fmt.Sprintf("模型 %s", summary.ModelName))
	}

	logContent := strings.Join(extraContent, ", ")
	var other map[string]interface{}
	if summary.IsClaudeUsageSemantic {
		other = GenerateClaudeOtherInfo(ctx, relayInfo,
			summary.InputPrice, summary.GroupRatio, summary.OutputPrice,
			summary.CacheTokens, summary.CacheReadPrice,
			summary.CacheCreationTokens, summary.CacheWritePrice,
			summary.CacheCreationTokens5m, summary.CacheWritePrice,
			summary.CacheCreationTokens1h, summary.CacheWritePrice,
			summary.RequestPrice)
		other["usage_semantic"] = "anthropic"
	} else {
		other = GenerateTextOtherInfo(ctx, relayInfo, summary.InputPrice, summary.GroupRatio, summary.OutputPrice, summary.CacheTokens, summary.CacheReadPrice, summary.RequestPrice)
	}
	if adminRejectReason != "" {
		other["reject_reason"] = adminRejectReason
	}
	if summary.ImageTokens != 0 {
		other["image"] = true
		other["image_price"] = summary.ImagePrice
		other["image_output"] = summary.ImageTokens
	}
	if summary.WebSearchCallCount > 0 {
		other["web_search"] = true
		other["web_search_call_count"] = summary.WebSearchCallCount
		other["web_search_price"] = summary.WebSearchPrice
	} else if summary.ClaudeWebSearchCallCount > 0 {
		other["web_search"] = true
		other["web_search_call_count"] = summary.ClaudeWebSearchCallCount
		other["web_search_price"] = summary.ClaudeWebSearchPrice
	}
	if summary.FileSearchCallCount > 0 {
		other["file_search"] = true
		other["file_search_call_count"] = summary.FileSearchCallCount
		other["file_search_price"] = summary.FileSearchPrice
	}
	if summary.AudioInputPrice > 0 && summary.AudioTokens > 0 {
		other["audio_input_seperate_price"] = true
		other["audio_input_token_count"] = summary.AudioTokens
		other["audio_input_price"] = summary.AudioInputPrice
	}
	if summary.ImageGenerationCallPrice > 0 {
		other["image_generation_call"] = true
		other["image_generation_call_price"] = summary.ImageGenerationCallPrice
	}
	if summary.CacheCreationTokens > 0 {
		other["cache_creation_tokens"] = summary.CacheCreationTokens
		other["cache_write_price"] = summary.CacheWritePrice
	}
	if summary.CacheCreationTokens5m > 0 {
		other["cache_creation_tokens_5m"] = summary.CacheCreationTokens5m
		other["cache_write_price_5m"] = summary.CacheWritePrice
	}
	if summary.CacheCreationTokens1h > 0 {
		other["cache_creation_tokens_1h"] = summary.CacheCreationTokens1h
		other["cache_write_price_1h"] = summary.CacheWritePrice
	}
	cacheWriteTokens := cacheWriteTokensTotal(summary)
	if cacheWriteTokens > 0 {
		// cache_write_tokens: normalized cache creation total for UI display.
		// If split 5m/1h values are present, this is their sum; otherwise it falls back
		// to cache_creation_tokens.
		other["cache_write_tokens"] = cacheWriteTokens
	}
	if relayInfo.GetFinalRequestRelayFormat() != types.RelayFormatClaude && usage != nil && usage.UsageSource != "" && usage.InputTokens > 0 {
		// input_tokens_total: explicit normalized total input used by the usage log UI.
		// Only write this field when upstream/current conversion has already provided a
		// reliable total input value and tagged the usage source. Do not infer it from
		// prompt/cache fields here, otherwise old upstream payloads may be double-counted.
		other["input_tokens_total"] = usage.InputTokens
	}

	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     summary.PromptTokens,
		CompletionTokens: summary.CompletionTokens,
		ModelName:        logModel,
		TokenName:        summary.TokenName,
		Quota:            summary.Quota,
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(summary.UseTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}
