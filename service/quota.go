package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"

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

func quotaInputTokenDetails(details dto.InputTokenDetails) TokenDetails {
	return TokenDetails{
		TextTokens:       details.TextTokens,
		AudioTokens:      details.AudioTokens,
		ImageTokens:      details.ImageTokens,
		CachedTokens:     details.CachedTokens,
		CacheWriteTokens: details.CacheCreationTokensTotal(),
	}
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
	groupRatio := decimal.NewFromFloat(info.GroupRatio)
	quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	if info.BillingType == model.ModelPricingBillingRequest {
		quota := decimal.NewFromFloat(info.RequestPrice).Mul(groupRatio).Mul(quotaPerUnit)
		if quota.GreaterThan(decimal.Zero) && quota.LessThan(decimal.NewFromInt(1)) {
			return 1
		}
		return int(quota.Round(0).IntPart())
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
		return 1
	}
	return int(quota.Round(0).IntPart())
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

	quota := calculateAudioQuota(quotaInfo)

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

	quota := finalRealtimeQuota(relayInfo, calculateAudioQuota(quotaInfo))

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
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
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

	quota := calculateAudioQuota(quotaInfo)

	totalTokens := usage.TotalTokens
	var logContent string
	if relayInfo.PriceData.BillingType == model.ModelPricingBillingRequest {
		logContent = fmt.Sprintf("模型按次价格 %.6f 美元，分组倍率 %.2f", requestPrice, groupRatio)
	} else {
		logContent = fmt.Sprintf("输入 %.6f / 1M，输出 %.6f / 1M，音频输入 %.6f / 1M，音频输出 %.6f / 1M，分组倍率 %.2f", inputPrice, outputPrice, audioInputPrice, audioOutputPrice, groupRatio)
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent += fmt.Sprintf("（可能是上游超时）")
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, relayInfo.OriginModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
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
}

func PreConsumeTokenQuota(relayInfo *relaycommon.RelayInfo, quota int) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
	}
	if relayInfo.IsPlayground {
		return nil
	}
	//if relayInfo.TokenUnlimited {
	//	return nil
	//}
	token, err := model.GetTokenByKey(relayInfo.TokenKey, false)
	if err != nil {
		return err
	}
	if !relayInfo.TokenUnlimited && token.RemainQuota < quota {
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(token.RemainQuota), logger.FormatQuota(quota))
	}
	err = model.DecreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota)
	if err != nil {
		return err
	}
	return nil
}

func PostConsumeQuota(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int, sendEmail bool) (err error) {

	// 1) Consume from wallet quota OR subscription item
	if relayInfo != nil && relayInfo.BillingSource == BillingSourceSubscription {
		if relayInfo.SubscriptionId == 0 {
			return errors.New("subscription id is missing")
		}
		delta := int64(quota)
		if delta != 0 {
			if err := model.PostConsumeUserSubscriptionDelta(relayInfo.SubscriptionId, delta); err != nil {
				return err
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
			return err
		}
	}

	if !relayInfo.IsPlayground {
		if quota > 0 {
			err = model.DecreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota)
		} else {
			err = model.IncreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, -quota)
		}
		if err != nil {
			return err
		}
	}

	if sendEmail {
		if (quota + preConsumedQuota) != 0 {
			checkAndSendQuotaNotify(relayInfo, quota, preConsumedQuota)
		}
	}

	return nil
}

func checkAndSendQuotaNotify(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int) {
	gopool.Go(func() {
		userSetting := relayInfo.UserSetting
		threshold := common.QuotaRemindThreshold
		if userSetting.QuotaWarningThreshold != 0 {
			threshold = int(userSetting.QuotaWarningThreshold)
		}

		//noMoreQuota := userCache.Quota-(quota+preConsumedQuota) <= 0
		quotaTooLow := false
		consumeQuota := quota + preConsumedQuota
		if relayInfo.UserQuota-consumeQuota < threshold {
			quotaTooLow = true
		}
		if quotaTooLow {
			prompt := "您的额度即将用尽"
			topUpLink := fmt.Sprintf("%s/console/topup", system_setting.ServerAddress)

			// 根据通知方式生成不同的内容格式
			var content string
			var values []interface{}

			notifyType := userSetting.NotifyType
			if notifyType == "" {
				notifyType = dto.NotifyTypeEmail
			}

			if notifyType == dto.NotifyTypeBark {
				// Bark推送使用简短文本，不支持HTML
				content = "{{value}}，剩余额度：{{value}}，请及时充值"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota)}
			} else if notifyType == dto.NotifyTypeGotify {
				content = "{{value}}，当前剩余额度为 {{value}}，请及时充值。"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota)}
			} else {
				// 默认内容格式，适用于Email和Webhook（支持HTML）
				content = "{{value}}，当前剩余额度为 {{value}}，为了不影响您的使用，请及时充值。<br/>充值链接：<a href='{{value}}'>{{value}}</a>"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota), topUpLink, topUpLink}
			}

			err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values))
			if err != nil {
				common.SysError(fmt.Sprintf("failed to send quota notify to user %d: %s", relayInfo.UserId, err.Error()))
			}
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
		threshold := common.QuotaRemindThreshold
		if userSetting.QuotaWarningThreshold != 0 {
			threshold = int(userSetting.QuotaWarningThreshold)
		}

		usedAfter := relayInfo.SubscriptionAmountUsedAfterPreConsume + relayInfo.SubscriptionPostDelta
		remaining := relayInfo.SubscriptionAmountTotal - usedAfter
		if remaining >= int64(threshold) {
			return
		}

		prompt := "您的订阅额度即将用尽"
		topUpLink := fmt.Sprintf("%s/console/topup", system_setting.ServerAddress)

		var content string
		var values []interface{}
		notifyType := userSetting.NotifyType
		if notifyType == "" {
			notifyType = dto.NotifyTypeEmail
		}

		if notifyType == dto.NotifyTypeBark {
			content = "{{value}}，剩余额度：{{value}}，请及时充值"
			values = []interface{}{prompt, logger.FormatQuota(int(remaining))}
		} else if notifyType == dto.NotifyTypeGotify {
			content = "{{value}}，当前剩余额度为 {{value}}，请及时充值。"
			values = []interface{}{prompt, logger.FormatQuota(int(remaining))}
		} else {
			content = "{{value}}，当前剩余额度为 {{value}}，为了不影响您的使用，请及时充值。<br/>充值链接：<a href='{{value}}'>{{value}}</a>"
			values = []interface{}{prompt, logger.FormatQuota(int(remaining)), topUpLink, topUpLink}
		}

		if err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values)); err != nil {
			common.SysError(fmt.Sprintf("failed to send subscription quota notify to user %d: %s", relayInfo.UserId, err.Error()))
		}
	})
}
