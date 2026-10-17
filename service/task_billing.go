package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// LogTaskConsumption 记录任务消费日志和统计信息（仅记录，不涉及实际扣费）。
// 实际扣费已由 BillingSession（PreConsumeBilling + SettleBilling）完成。
func LogTaskConsumption(c *gin.Context, info *relaycommon.RelayInfo) {
	tokenName := c.GetString("token_name")
	logContent := fmt.Sprintf("操作 %s", info.Action)
	if info.PriceData.BillingType == model.ModelPricingBillingRequest {
		logContent = fmt.Sprintf("%s，按次计费", logContent)
	} else {
		if len(info.PriceData.OtherRatios()) > 0 {
			var contents []string
			for key, ra := range info.PriceData.OtherRatios() {
				if 1.0 != ra {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
			if len(contents) > 0 {
				logContent = fmt.Sprintf("%s, 计算参数：%s", logContent, strings.Join(contents, ", "))
			}
		}
	}
	other := make(map[string]interface{})
	other["is_task"] = true
	other["request_path"] = c.Request.URL.Path
	other["billing_type"] = info.PriceData.BillingType
	other["input_price"] = info.PriceData.InputPrice
	other["output_price"] = info.PriceData.OutputPrice
	other["cache_read_price"] = info.PriceData.CacheReadPrice
	other["cache_write_price"] = info.PriceData.CacheWritePrice
	other["image_price"] = info.PriceData.ImagePrice
	other["audio_input_price"] = info.PriceData.AudioInputPrice
	other["audio_output_price"] = info.PriceData.AudioOutputPrice
	other["request_price"] = info.PriceData.RequestPrice
	other["group_ratio"] = info.PriceData.GroupRatioInfo.GroupRatio
	if info.IsModelMapped {
		other["is_model_mapped"] = true
		other["upstream_model_name"] = info.UpstreamModelName
	}
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId: info.ChannelId,
		ModelName: info.OriginModelName,
		TokenName: tokenName,
		Quota:     info.PriceData.Quota,
		Content:   logContent,
		TokenId:   info.TokenId,
		Group:     info.UsingGroup,
		Other:     other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
}
