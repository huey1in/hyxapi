package service

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type TokenDetails struct {
	TextTokens        int
	AudioTokens       int
	ImageTokens       int
	CachedTokens      int
	CacheWriteTokens  int
	CachedTextTokens  int
	CachedAudioTokens int
	CachedImageTokens int
}

// CalcOpenRouterCacheCreateTokens reconstructs missing cache writes from a
// provider-reported USD cost. Callers must first verify the default tariff.
// -1 means that the cost or the inferred count is not usable.
func CalcOpenRouterCacheCreateTokens(usage dto.Usage, priceData types.PriceData) int {
	if priceData.CacheCreationRatio == 1 {
		return 0
	}
	cost, ok := usage.Cost.(float64)
	if !ok || cost <= 0 || math.IsNaN(cost) || math.IsInf(cost, 0) || priceData.ModelRatio <= 0 {
		return -1
	}
	inputPrice := priceData.ModelRatio / common.QuotaPerUnit
	value := (cost - float64(usage.PromptTokens)*inputPrice +
		float64(usage.PromptTokensDetails.CachedTokens)*inputPrice*(1-priceData.CacheRatio) -
		float64(usage.CompletionTokens)*inputPrice*priceData.CompletionRatio) /
		(inputPrice * (priceData.CacheCreationRatio - 1))
	tokens, clamp := common.QuotaRoundChecked(value)
	if clamp != nil || tokens < 0 {
		return -1
	}
	return tokens
}

func quotaInputTokenDetails(details dto.InputTokenDetails) TokenDetails {
	result := TokenDetails{
		TextTokens:       details.TextTokens,
		AudioTokens:      details.AudioTokens,
		ImageTokens:      details.ImageTokens,
		CachedTokens:     details.CachedTokens,
		CacheWriteTokens: details.CacheCreationTokensTotal(),
	}
	if cached := details.CachedTokensDetails; cached != nil {
		if cached.TextTokens != nil {
			result.CachedTextTokens = *cached.TextTokens
		}
		if cached.AudioTokens != nil {
			result.CachedAudioTokens = *cached.AudioTokens
		}
		if cached.ImageTokens != nil {
			result.CachedImageTokens = *cached.ImageTokens
		}
	}
	return result
}

type QuotaInfo struct {
	InputDetails     TokenDetails
	OutputDetails    TokenDetails
	ModelName        string
	BillingType      int
	InputPrice       float64
	OutputPrice      float64
	CacheReadPrice   float64
	CacheWritePrice  float64
	ImagePrice       float64
	AudioInputPrice  float64
	AudioOutputPrice float64
	RequestPrice     float64
	GroupRatio       float64
}

func calculateAudioQuota(info QuotaInfo) int {
	quota, _ := calculateAudioQuotaChecked(info)
	return quota
}

func calculateAudioQuotaChecked(info QuotaInfo) (int, *common.QuotaClamp) {
	groupRatio := decimal.NewFromFloat(info.GroupRatio)
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	if info.BillingType == model.ModelPricingBillingRequest {
		quota := decimal.NewFromFloat(info.RequestPrice).Mul(groupRatio).Mul(quotaPerUnit)
		if quota.GreaterThan(decimal.Zero) && quota.LessThan(decimal.NewFromInt(1)) {
			return 1, nil
		}
		return common.QuotaFromDecimalChecked(quota)
	}
	perMillion := decimal.NewFromInt(1_000_000)
	inputTextTokenCount := max(info.InputDetails.TextTokens, 0)
	inputAudioTokenCount := max(info.InputDetails.AudioTokens, 0)
	inputImageTokenCount := max(info.InputDetails.ImageTokens, 0)
	cachedTextTokenCount := min(max(info.InputDetails.CachedTextTokens, 0), inputTextTokenCount)
	cachedAudioTokenCount := min(max(info.InputDetails.CachedAudioTokens, 0), inputAudioTokenCount)
	cachedImageTokenCount := min(max(info.InputDetails.CachedImageTokens, 0), inputImageTokenCount)
	cachedTokenCount := max(info.InputDetails.CachedTokens, cachedTextTokenCount+cachedAudioTokenCount+cachedImageTokenCount)
	cachedTokenCount = max(cachedTokenCount, 0)

	remainingCachedTokens := cachedTokenCount - cachedTextTokenCount - cachedAudioTokenCount - cachedImageTokenCount
	extraCachedTextTokens := min(remainingCachedTokens, inputTextTokenCount-cachedTextTokenCount)
	cachedTextTokenCount += extraCachedTextTokens
	remainingCachedTokens -= extraCachedTextTokens
	extraCachedAudioTokens := min(remainingCachedTokens, inputAudioTokenCount-cachedAudioTokenCount)
	cachedAudioTokenCount += extraCachedAudioTokens
	remainingCachedTokens -= extraCachedAudioTokens
	extraCachedImageTokens := min(remainingCachedTokens, inputImageTokenCount-cachedImageTokenCount)
	cachedImageTokenCount += extraCachedImageTokens

	inputTextTokenCount -= cachedTextTokenCount
	inputAudioTokenCount -= cachedAudioTokenCount
	inputImageTokenCount -= cachedImageTokenCount
	cacheWriteTokenCount := max(info.InputDetails.CacheWriteTokens, 0)
	remainingCacheWriteTokens := cacheWriteTokenCount
	cacheWriteTextTokens := min(remainingCacheWriteTokens, inputTextTokenCount)
	inputTextTokenCount -= cacheWriteTextTokens
	remainingCacheWriteTokens -= cacheWriteTextTokens
	cacheWriteAudioTokens := min(remainingCacheWriteTokens, inputAudioTokenCount)
	inputAudioTokenCount -= cacheWriteAudioTokens
	remainingCacheWriteTokens -= cacheWriteAudioTokens
	cacheWriteImageTokens := min(remainingCacheWriteTokens, inputImageTokenCount)
	inputImageTokenCount -= cacheWriteImageTokens

	inputTextTokens := decimal.NewFromInt(int64(inputTextTokenCount))
	outputTextTokens := decimal.NewFromInt(int64(info.OutputDetails.TextTokens))
	inputAudioTokens := decimal.NewFromInt(int64(inputAudioTokenCount))
	inputImageTokens := decimal.NewFromInt(int64(inputImageTokenCount))
	outputAudioTokens := decimal.NewFromInt(int64(info.OutputDetails.AudioTokens))
	cacheReadTokens := decimal.NewFromInt(int64(cachedTokenCount))
	cacheWriteTokens := decimal.NewFromInt(int64(cacheWriteTokenCount))
	cost := inputTextTokens.Mul(decimal.NewFromFloat(info.InputPrice)).Add(
		outputTextTokens.Mul(decimal.NewFromFloat(info.OutputPrice)),
	).Add(
		inputAudioTokens.Mul(decimal.NewFromFloat(info.AudioInputPrice)),
	).Add(
		outputAudioTokens.Mul(decimal.NewFromFloat(info.AudioOutputPrice)),
	).Add(
		cacheReadTokens.Mul(decimal.NewFromFloat(info.CacheReadPrice)),
	).Add(
		cacheWriteTokens.Mul(decimal.NewFromFloat(info.CacheWritePrice)),
	).Add(
		inputImageTokens.Mul(decimal.NewFromFloat(info.ImagePrice)),
	).Div(perMillion)
	quota := cost.Mul(groupRatio).Mul(quotaPerUnit)
	if quota.GreaterThan(decimal.Zero) && quota.LessThan(decimal.NewFromInt(1)) {
		return 1, nil
	}
	return common.QuotaFromDecimalChecked(quota)
}

// calculateRealtimeUsageQuota uses the same token normalization as HTTP audio.
// Final logs use the accumulated per-response charges, preserving tier choices.
func calculateRealtimeUsageQuota(info *relaycommon.RelayInfo, usage *dto.RealtimeUsage, fallback QuotaInfo) (int, *billingexpr.TieredResult) {
	if snap := info.TieredBillingSnapshot; snap != nil {
		canonical := &dto.Usage{
			PromptTokens: usage.InputTokens, CompletionTokens: usage.OutputTokens,
			PromptTokensDetails: usage.InputTokenDetails, CompletionTokenDetails: usage.OutputTokenDetails,
		}
		vars := billingexpr.UsedVarsByHash(snap.ExprString, snap.ExprHash)
		if ok, quota, result := TryTieredSettle(info, BuildTieredTokenParams(canonical, false, vars)); ok {
			return quota, result
		}
	}
	quota, clamp := calculateAudioQuotaChecked(fallback)
	noteQuotaClamp(info, clamp)
	return quota, nil
}

func PreWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) error {
	if relayInfo.PriceData.BillingType == model.ModelPricingBillingRequest {
		return nil
	}
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return err
	}

	token, err := model.GetTokenByKey(strings.TrimPrefix(relayInfo.TokenKey, "sk-"), false)
	if err != nil {
		return err
	}

	modelName := relayInfo.OriginModelName
	textOutTokens := usage.OutputTokenDetails.TextTokens
	audioOutTokens := usage.OutputTokenDetails.AudioTokens
	actualGroupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio

	quotaInfo := QuotaInfo{
		InputDetails: quotaInputTokenDetails(usage.InputTokenDetails),
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:        modelName,
		BillingType:      relayInfo.PriceData.BillingType,
		InputPrice:       relayInfo.PriceData.InputPrice,
		OutputPrice:      relayInfo.PriceData.OutputPrice,
		CacheReadPrice:   relayInfo.PriceData.CacheReadPrice,
		CacheWritePrice:  relayInfo.PriceData.CacheWritePrice,
		ImagePrice:       relayInfo.PriceData.ImagePrice,
		AudioInputPrice:  relayInfo.PriceData.AudioInputPrice,
		AudioOutputPrice: relayInfo.PriceData.AudioOutputPrice,
		RequestPrice:     relayInfo.PriceData.RequestPrice,
		GroupRatio:       actualGroupRatio,
	}

	quota, _ := calculateRealtimeUsageQuota(relayInfo, usage, quotaInfo)

	if userQuota < quota {
		return fmt.Errorf("user quota is not enough, user quota: %s, need quota: %s", logger.FormatQuota(userQuota), logger.FormatQuota(quota))
	}

	if !token.UnlimitedQuota && token.RemainQuota < quota {
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(token.RemainQuota), logger.FormatQuota(quota))
	}

	err = PostConsumeQuota(relayInfo, quota, 0, false)
	if err != nil {
		return err
	}
	relayInfo.RealtimeConsumedQuota += quota
	logger.LogInfo(ctx, "realtime streaming consume quota success, quota: "+fmt.Sprintf("%d", quota))
	return nil
}

func PostWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelName string,
	usage *dto.RealtimeUsage, extraContent string) {

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	textOutTokens := usage.OutputTokenDetails.TextTokens

	audioOutTokens := usage.OutputTokenDetails.AudioTokens

	tokenName := ctx.GetString("token_name")
	inputPrice := relayInfo.PriceData.InputPrice
	outputPrice := relayInfo.PriceData.OutputPrice
	audioInputPrice := relayInfo.PriceData.AudioInputPrice
	audioOutputPrice := relayInfo.PriceData.AudioOutputPrice
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	requestPrice := relayInfo.PriceData.RequestPrice

	quotaInfo := QuotaInfo{
		InputDetails: quotaInputTokenDetails(usage.InputTokenDetails),
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:        modelName,
		BillingType:      relayInfo.PriceData.BillingType,
		InputPrice:       inputPrice,
		OutputPrice:      outputPrice,
		CacheReadPrice:   relayInfo.PriceData.CacheReadPrice,
		CacheWritePrice:  relayInfo.PriceData.CacheWritePrice,
		ImagePrice:       relayInfo.PriceData.ImagePrice,
		AudioInputPrice:  audioInputPrice,
		AudioOutputPrice: audioOutputPrice,
		RequestPrice:     requestPrice,
		GroupRatio:       groupRatio,
	}

	calculatedQuota, tieredResult := calculateRealtimeUsageQuota(relayInfo, usage, quotaInfo)
	quota := finalRealtimeQuota(relayInfo, calculatedQuota)

	totalTokens := usage.TotalTokens
	var logContent string
	if relayInfo.PriceData.BillingType == model.ModelPricingBillingRequest {
		logContent = fmt.Sprintf("模型按次价格 %.6f 美元，分组倍率 %.2f", requestPrice, groupRatio)
	} else {
		logContent = fmt.Sprintf("输入 %.6f / 1M，输出 %.6f / 1M，分组倍率 %.2f", inputPrice, outputPrice, groupRatio)
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent += fmt.Sprintf("（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, modelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuota(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}
	if err := settleRealtimeBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, "error settling realtime billing: "+err.Error())
	}

	logModel := modelName
	if extraContent != "" {
		logContent += ", " + extraContent
	}
	other := GenerateWssOtherInfo(ctx, relayInfo, usage, inputPrice, groupRatio,
		outputPrice, audioInputPrice, audioOutputPrice, requestPrice)
	InjectTieredBillingInfo(other, relayInfo, tieredResult)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.InputTokens,
		CompletionTokens: usage.OutputTokens,
		ModelName:        logModel,
		TokenName:        tokenName,
		Quota:            quota,
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}

func settleRealtimeBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, quota int) error {
	if relayInfo == nil {
		return nil
	}
	if relayInfo.PriceData.BillingType == model.ModelPricingBillingToken {
		// Token-billed Realtime usage is charged incrementally. The zero-amount
		// session exists only to select and validate the funding source; settling
		// it at zero releases the subscription bootstrap reservation, if any.
		quota = 0
	}
	return SettleBilling(ctx, relayInfo, quota)
}

func finalRealtimeQuota(relayInfo *relaycommon.RelayInfo, calculatedQuota int) int {
	if relayInfo != nil && relayInfo.PriceData.BillingType == model.ModelPricingBillingToken {
		return relayInfo.RealtimeConsumedQuota
	}
	return calculatedQuota
}

func PostAudioConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, extraContent string) {

	originUsage := usage
	usage = effectiveBillingUsage(usage)
	if usage == nil {
		usage = &dto.Usage{PromptTokens: relayInfo.GetEstimatePromptTokens(), TotalTokens: relayInfo.GetEstimatePromptTokens()}
	}
	var usedVars map[string]bool
	if snap := relayInfo.TieredBillingSnapshot; snap != nil {
		usedVars = billingexpr.UsedVarsByHash(snap.ExprString, snap.ExprHash)
	}
	tiered, tieredQuota, tieredResult := TryTieredSettle(relayInfo, BuildTieredTokenParams(usage, false, usedVars))
	fixedPriceBilling := tiered && isFixedPriceSettlement(relayInfo, tieredResult)
	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	textOutTokens := usage.CompletionTokenDetails.TextTokens

	audioOutTokens := usage.CompletionTokenDetails.AudioTokens

	tokenName := ctx.GetString("token_name")
	inputPrice := relayInfo.PriceData.InputPrice
	outputPrice := relayInfo.PriceData.OutputPrice
	audioInputPrice := relayInfo.PriceData.AudioInputPrice
	audioOutputPrice := relayInfo.PriceData.AudioOutputPrice
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	requestPrice := relayInfo.PriceData.RequestPrice

	quotaInfo := QuotaInfo{
		InputDetails: quotaInputTokenDetails(usage.PromptTokensDetails),
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:        relayInfo.OriginModelName,
		BillingType:      relayInfo.PriceData.BillingType,
		InputPrice:       inputPrice,
		OutputPrice:      outputPrice,
		CacheReadPrice:   relayInfo.PriceData.CacheReadPrice,
		CacheWritePrice:  relayInfo.PriceData.CacheWritePrice,
		ImagePrice:       relayInfo.PriceData.ImagePrice,
		AudioInputPrice:  audioInputPrice,
		AudioOutputPrice: audioOutputPrice,
		RequestPrice:     requestPrice,
		GroupRatio:       groupRatio,
	}

	quota, clamp := calculateAudioQuotaChecked(quotaInfo)
	if tiered {
		quota = tieredQuota
	} else {
		noteQuotaClamp(relayInfo, clamp)
	}

	totalTokens := usage.TotalTokens
	var logContent string
	if relayInfo.PriceData.BillingType == model.ModelPricingBillingRequest {
		logContent = fmt.Sprintf("模型按次价格 %.6f 美元，分组倍率 %.2f", requestPrice, groupRatio)
	} else {
		logContent = fmt.Sprintf("输入 %.6f / 1M，输出 %.6f / 1M，音频输入 %.6f / 1M，音频输出 %.6f / 1M，分组倍率 %.2f", inputPrice, outputPrice, audioInputPrice, audioOutputPrice, groupRatio)
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 && !fixedPriceBilling && relayInfo.PriceData.BillingType != model.ModelPricingBillingRequest {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent += fmt.Sprintf("（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, relayInfo.OriginModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuota(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	if err := SettleBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, "error settling billing: "+err.Error())
	}

	logModel := relayInfo.OriginModelName
	if extraContent != "" {
		logContent += ", " + extraContent
	}
	other := GenerateAudioOtherInfo(ctx, relayInfo, usage, inputPrice, groupRatio,
		outputPrice, audioInputPrice, audioOutputPrice, requestPrice)
	InjectTieredBillingInfo(other, relayInfo, tieredResult)
	appendUsageBillingPathForLog(other, common.GetContextKeyBool(ctx, constant.ContextKeyLocalCountTokens), originUsage)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		ModelName:        logModel,
		TokenName:        tokenName,
		Quota:            quota,
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
	relayInfo.PerformanceOutputTokens = int64(usage.CompletionTokens)
}

func PreConsumeTokenQuota(relayInfo *relaycommon.RelayInfo, quota int) error {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	// 原子预扣：检查与扣减在同一操作中完成，并发请求不可能同时通过检查后超扣。
	reserved, err := model.TryReserveTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota, relayInfo.TokenUnlimited)
	if err != nil {
		return err
	}
	if !reserved {
		remainQuota := 0
		if token, tokenErr := model.GetTokenByKey(relayInfo.TokenKey, false); tokenErr == nil && token != nil {
			remainQuota = token.RemainQuota
		}
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(remainQuota), logger.FormatQuota(quota))
	}
	return nil
}

type postConsumeQuotaResult struct {
	FundingApplied bool
	TokenApplied   bool
}

func PostConsumeQuota(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int, sendEmail bool) error {
	_, err := postConsumeQuotaWithResult(relayInfo, quota, preConsumedQuota, sendEmail)
	return err
}

func postConsumeQuotaWithResult(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int, sendEmail bool) (result postConsumeQuotaResult, err error) {

	// 1) Consume from wallet quota OR subscription item
	if relayInfo != nil && relayInfo.BillingSource == BillingSourceSubscription {
		if relayInfo.SubscriptionId == 0 {
			return result, errors.New("subscription id is missing")
		}
		delta := int64(quota)
		if delta != 0 {
			if err := model.PostConsumeUserSubscriptionDelta(relayInfo.SubscriptionId, delta); err != nil {
				return result, err
			}
			relayInfo.SubscriptionPostDelta += delta
		}
	} else {
		// Wallet
		if quota > 0 {
			err = model.DecreaseUserQuota(relayInfo.UserId, quota, false)
		} else {
			err = model.IncreaseUserQuota(relayInfo.UserId, -quota, false)
		}
		if err != nil {
			return result, err
		}
	}
	result.FundingApplied = true

	if quota > 0 {
		err = model.DecreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota)
	} else {
		err = model.IncreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, -quota)
	}
	if err != nil {
		return result, err
	}
	result.TokenApplied = true

	if sendEmail {
		if (quota + preConsumedQuota) != 0 {
			checkAndSendQuotaNotify(relayInfo, quota, preConsumedQuota)
		}
	}

	return result, nil
}

func checkAndSendQuotaNotify(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int) {
	gopool.Go(func() {
		userSetting := relayInfo.UserSetting
		// UserQuota is the balance before this request; quota plus
		// preConsumedQuota is what the request finally cost.
		balanceAfter := relayInfo.UserQuota - (quota + preConsumedQuota)
		if !quotaReminderDue(userSetting, int64(relayInfo.UserQuota), int64(balanceAfter)) {
			return
		}
		lang := userSetting.Language
		prompt := i18n.Translate(lang, i18n.MsgNotifyQuotaLowTitle)
		content, values := quotaNotifyContent(lang, userSetting.NotifyType, prompt, logger.FormatQuota(balanceAfter))
		err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values))
		if err != nil {
			common.SysError(fmt.Sprintf("failed to send quota notify to user %d: %s", relayInfo.UserId, err.Error()))
		}
	})
}

func checkAndSendSubscriptionQuotaNotify(relayInfo *relaycommon.RelayInfo) {
	gopool.Go(func() {
		if relayInfo == nil {
			return
		}
		if relayInfo.SubscriptionId == 0 || relayInfo.SubscriptionAmountTotal <= 0 {
			return
		}

		userSetting := relayInfo.UserSetting
		usedBefore := relayInfo.SubscriptionAmountUsedAfterPreConsume - relayInfo.SubscriptionPreConsumed
		usedAfter := relayInfo.SubscriptionAmountUsedAfterPreConsume + relayInfo.SubscriptionPostDelta
		remaining := relayInfo.SubscriptionAmountTotal - usedAfter
		if !quotaReminderDue(userSetting, relayInfo.SubscriptionAmountTotal-usedBefore, remaining) {
			return
		}

		lang := userSetting.Language
		prompt := i18n.Translate(lang, i18n.MsgNotifySubscriptionQuotaLowTitle)
		content, values := quotaNotifyContent(lang, userSetting.NotifyType, prompt, logger.FormatQuota(int(remaining)))
		if err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values)); err != nil {
			common.SysError(fmt.Sprintf("failed to send subscription quota notify to user %d: %s", relayInfo.UserId, err.Error()))
		}
	})
}

// quotaReminderDue reports whether a charge that moved a balance (wallet or
// subscription) from before to after earns a low-balance reminder. The site
// and the user must both have reminders on, and the charge must cross the
// user's threshold, or the site default when the user set none. A balance
// already below the threshold earns nothing more until a top-up lifts it back
// above, so a user gets one reminder per drop.
func quotaReminderDue(userSetting dto.UserSetting, before int64, after int64) bool {
	if !common.QuotaRemindEnabled {
		return false
	}
	if userSetting.QuotaWarningEnabled != nil && !*userSetting.QuotaWarningEnabled {
		return false
	}
	threshold := float64(common.QuotaRemindThreshold)
	if userSetting.QuotaWarningThreshold != 0 {
		threshold = userSetting.QuotaWarningThreshold
	}
	return float64(before) >= threshold && float64(after) < threshold
}

// quotaNotifyContent renders a low-quota notice in the user's saved language.
// Bark and Gotify get plain text; email and webhook get HTML with the top-up
// link. values stay in the notify payload for webhook receivers.
func quotaNotifyContent(lang string, notifyType string, prompt string, remaining string) (string, []any) {
	switch notifyType {
	case dto.NotifyTypeBark:
		// Bark推送使用简短文本，不支持HTML
		return i18n.Translate(lang, i18n.MsgNotifyQuotaLowBark, map[string]any{"Prompt": prompt, "Quota": remaining}), []any{prompt, remaining}
	case dto.NotifyTypeGotify:
		return i18n.Translate(lang, i18n.MsgNotifyQuotaLowGotify, map[string]any{"Prompt": prompt, "Quota": remaining}), []any{prompt, remaining}
	default:
		topUpLink := fmt.Sprintf("%s/console/topup", system_setting.ServerAddress)
		return i18n.Translate(lang, i18n.MsgNotifyQuotaLowEmail, map[string]any{"Prompt": prompt, "Quota": remaining, "Link": topUpLink}), []any{prompt, remaining, topUpLink, topUpLink}
	}
}
