package relay

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

func PrepareRequestBilling(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	meta := &types.TokenCountMeta{TokenType: types.TokenTypeTokenizer}
	if info.Request != nil && (setting.ShouldCheckPromptSensitive() || constant.CountToken) {
		meta = info.Request.GetTokenCountMeta()
	} else if request, ok := info.Request.(*dto.OpenAIResponsesRequest); ok && request.MaxOutputTokens != nil {
		meta.MaxTokens = int(*request.MaxOutputTokens)
	}
	if setting.ShouldCheckPromptSensitive() && meta != nil {
		if contains, words := service.CheckSensitiveText(meta.CombineText); contains {
			return types.NewError(errors.New("user sensitive words detected: "+strings.Join(words, ", ")), types.ErrorCodeSensitiveWordsDetected, types.ErrOptionWithSkipRetry())
		}
	}
	tokens, err := service.EstimateRequestToken(c, meta, info)
	if err != nil {
		return types.NewError(err, types.ErrorCodeCountTokenFailed)
	}
	info.SetEstimatePromptTokens(tokens)
	price, err := helper.ModelPriceHelper(c, info, tokens, meta)
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
	}
	if price.FreeModel {
		return nil
	}
	return service.PreConsumeBilling(c, price.QuotaToPreConsume, info)
}

func RefundFailedRequestBilling(c *gin.Context, info *relaycommon.RelayInfo, apiErr *types.NewAPIError) *types.NewAPIError {
	if apiErr == nil {
		return nil
	}
	apiErr = service.NormalizeViolationFeeError(apiErr)
	if info.Billing != nil {
		info.Billing.Refund(c)
	}
	service.ChargeViolationFeeIfNeeded(c, info, apiErr)
	return apiErr
}

func ConsumeResponsesQuota(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage) {
	if strings.HasPrefix(info.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, info, usage, "")
	} else {
		service.PostTextConsumeQuota(c, info, usage, nil)
	}
}
