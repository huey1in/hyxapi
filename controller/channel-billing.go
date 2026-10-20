package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/advancedcustom"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"

	"github.com/gin-gonic/gin"
)

// https://github.com/songquanpeng/one-api/issues/79

type OpenAISubscriptionResponse struct {
	Object             string  `json:"object"`
	HasPaymentMethod   bool    `json:"has_payment_method"`
	SoftLimitUSD       float64 `json:"soft_limit_usd"`
	HardLimitUSD       float64 `json:"hard_limit_usd"`
	SystemHardLimitUSD float64 `json:"system_hard_limit_usd"`
	AccessUntil        int64   `json:"access_until"`
}

type OpenAIUsageResponse struct {
	Object     string  `json:"object"`
	TotalUsage float64 `json:"total_usage"` // unit: 0.01 dollar
}

type AIProxyUserOverviewResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	ErrorCode int    `json:"error_code"`
	Data      struct {
		TotalPoints float64 `json:"totalPoints"`
	} `json:"data"`
}

type API2GPTUsageResponse struct {
	Object         string  `json:"object"`
	TotalGranted   float64 `json:"total_granted"`
	TotalUsed      float64 `json:"total_used"`
	TotalRemaining float64 `json:"total_remaining"`
}

type APGC2DGPTUsageResponse struct {
	//Grants         interface{} `json:"grants"`
	Object         string  `json:"object"`
	TotalAvailable float64 `json:"total_available"`
	TotalGranted   float64 `json:"total_granted"`
	TotalUsed      float64 `json:"total_used"`
}

type SiliconFlowUsageResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  bool   `json:"status"`
	Data    struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		Image         string `json:"image"`
		Email         string `json:"email"`
		IsAdmin       bool   `json:"isAdmin"`
		Balance       string `json:"balance"`
		Status        string `json:"status"`
		Introduction  string `json:"introduction"`
		Role          string `json:"role"`
		ChargeBalance string `json:"chargeBalance"`
		TotalBalance  string `json:"totalBalance"`
		Category      string `json:"category"`
	} `json:"data"`
}

type DeepSeekUsageResponse struct {
	IsAvailable  bool `json:"is_available"`
	BalanceInfos []struct {
		Currency        string `json:"currency"`
		TotalBalance    string `json:"total_balance"`
		GrantedBalance  string `json:"granted_balance"`
		ToppedUpBalance string `json:"topped_up_balance"`
	} `json:"balance_infos"`
}

type OpenRouterCreditResponse struct {
	Data struct {
		TotalCredits float64 `json:"total_credits"`
		TotalUsage   float64 `json:"total_usage"`
	} `json:"data"`
}

// GetAuthHeader get auth header
func GetAuthHeader(token string) http.Header {
	h := http.Header{}
	h.Add("Authorization", fmt.Sprintf("Bearer %s", token))
	return h
}

// GetClaudeAuthHeader get claude auth header
func GetClaudeAuthHeader(token string) http.Header {
	h := http.Header{}
	h.Add("x-api-key", token)
	h.Add("anthropic-version", "2023-06-01")
	return h
}

func GetResponseBody(ctx context.Context, method, requestURL string, channel *model.Channel, headers http.Header) ([]byte, error) {
	body, err := getFetchModelsResponseBody(ctx, method, requestURL, channel, headers)
	return body, sanitizeAdvancedCustomRequestError(err, channel.Key, requestURL)
}

func updateChannelAIProxyBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://aiproxy.io/api/report/getUserOverview"
	headers := http.Header{}
	headers.Add("Api-Key", channel.Key)
	body, err := GetResponseBody(ctx, "GET", url, channel, headers)
	if err != nil {
		return 0, err
	}
	response := AIProxyUserOverviewResponse{}
	err = json.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	if !response.Success {
		return 0, fmt.Errorf("code: %d, message: %s", response.ErrorCode, response.Message)
	}
	return persistChannelBalance(ctx, channel, response.Data.TotalPoints)
}

func updateChannelAPI2GPTBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://api.api2gpt.com/dashboard/billing/credit_grants"
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))

	if err != nil {
		return 0, err
	}
	response := API2GPTUsageResponse{}
	err = json.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	return persistChannelBalance(ctx, channel, response.TotalRemaining)
}

func updateChannelSiliconFlowBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://api.siliconflow.cn/v1/user/info"
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	response := SiliconFlowUsageResponse{}
	err = json.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	if response.Code != 20000 {
		return 0, fmt.Errorf("code: %d, message: %s", response.Code, response.Message)
	}
	balance, err := strconv.ParseFloat(response.Data.TotalBalance, 64)
	if err != nil {
		return 0, err
	}
	return persistChannelBalance(ctx, channel, balance)
}

func getDeepSeekBalanceUSD(response DeepSeekUsageResponse, usdExchangeRate float64) (float64, error) {
	var usdBalance *string
	var cnyBalance *string

	for i := range response.BalanceInfos {
		balanceInfo := &response.BalanceInfos[i]
		switch balanceInfo.Currency {
		case "USD":
			if usdBalance == nil {
				usdBalance = &balanceInfo.TotalBalance
			}
		case "CNY":
			if cnyBalance == nil {
				cnyBalance = &balanceInfo.TotalBalance
			}
		}
	}

	if usdBalance != nil {
		balance, err := strconv.ParseFloat(*usdBalance, 64)
		if err != nil {
			return 0, err
		}
		if math.IsNaN(balance) || math.IsInf(balance, 0) {
			return 0, errors.New("USD balance must be finite")
		}
		if balance < 0 {
			return 0, errors.New("USD balance must be non-negative")
		}
		return balance, nil
	}
	if cnyBalance == nil {
		return 0, errors.New("currency USD or CNY not found")
	}
	if math.IsNaN(usdExchangeRate) || math.IsInf(usdExchangeRate, 0) {
		return 0, errors.New("USD exchange rate must be finite")
	}
	if usdExchangeRate <= 0 {
		return 0, errors.New("USD exchange rate must be greater than zero")
	}

	balanceCNY, err := strconv.ParseFloat(*cnyBalance, 64)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(balanceCNY) || math.IsInf(balanceCNY, 0) {
		return 0, errors.New("CNY balance must be finite")
	}
	if balanceCNY < 0 {
		return 0, errors.New("CNY balance must be non-negative")
	}
	balanceUSD := decimal.NewFromFloat(balanceCNY).Div(decimal.NewFromFloat(usdExchangeRate)).InexactFloat64()
	if math.IsNaN(balanceUSD) || math.IsInf(balanceUSD, 0) {
		return 0, errors.New("converted USD balance must be finite")
	}
	if balanceUSD < 0 {
		return 0, errors.New("converted USD balance must be non-negative")
	}
	return balanceUSD, nil
}

func updateChannelDeepSeekBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://api.deepseek.com/user/balance"
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	response := DeepSeekUsageResponse{}
	err = common.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	balance, err := getDeepSeekBalanceUSD(response, operation_setting.USDExchangeRate)
	if err != nil {
		return 0, err
	}
	return persistChannelBalance(ctx, channel, balance)
}

func updateChannelAIGC2DBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://api.aigc2d.com/dashboard/billing/credit_grants"
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	response := APGC2DGPTUsageResponse{}
	err = json.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	return persistChannelBalance(ctx, channel, response.TotalAvailable)
}

func updateChannelOpenRouterBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://openrouter.ai/api/v1/credits"
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	response := OpenRouterCreditResponse{}
	err = json.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	balance := response.Data.TotalCredits - response.Data.TotalUsage
	return persistChannelBalance(ctx, channel, balance)
}

func updateChannelMoonshotBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	url := "https://api.moonshot.cn/v1/users/me/balance"
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}

	type MoonshotBalanceData struct {
		AvailableBalance float64 `json:"available_balance"`
		VoucherBalance   float64 `json:"voucher_balance"`
		CashBalance      float64 `json:"cash_balance"`
	}

	type MoonshotBalanceResponse struct {
		Code   int                 `json:"code"`
		Data   MoonshotBalanceData `json:"data"`
		Scode  string              `json:"scode"`
		Status bool                `json:"status"`
	}

	response := MoonshotBalanceResponse{}
	err = json.Unmarshal(body, &response)
	if err != nil {
		return 0, err
	}
	if !response.Status || response.Code != 0 {
		return 0, fmt.Errorf("failed to update moonshot balance, status: %v, code: %d, scode: %s", response.Status, response.Code, response.Scode)
	}
	availableBalanceCny := response.Data.AvailableBalance
	if math.IsNaN(availableBalanceCny) || math.IsInf(availableBalanceCny, 0) || math.IsNaN(operation_setting.Price) || math.IsInf(operation_setting.Price, 0) || operation_setting.Price <= 0 {
		return 0, errors.New("balance and exchange rate must be finite; exchange rate must be positive")
	}
	availableBalanceUsd := decimal.NewFromFloat(availableBalanceCny).Div(decimal.NewFromFloat(operation_setting.Price)).InexactFloat64()
	return persistChannelBalance(ctx, channel, availableBalanceUsd)
}

const maxAdvancedCustomBalanceResponseBytes = 256 << 10

type channelBalanceResult struct {
	Balance     float64
	RawResponse string
}

func fetchAdvancedCustomBalance(ctx context.Context, channel *model.Channel) (channelBalanceResult, error) {
	key := strings.TrimSpace(channel.Key)
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatOpenAI,
		RelayMode:      relayconstant.RelayModeUnknown,
		RequestURLPath: dto.AdvancedCustomBalancePath,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:          constant.ChannelTypeAdvancedCustom,
			ChannelBaseUrl:       channel.GetBaseURL(),
			ApiKey:               key,
			ChannelOtherSettings: channel.GetOtherSettings(),
		},
	}
	requestURL, headers, err := (&advancedcustom.Adaptor{}).BuildBalanceRequest(info)
	if err != nil {
		return channelBalanceResult{}, sanitizeFetchModelsError(err, key)
	}
	if err := applyFetchModelsHeaderOverrides(channel, key, headers); err != nil {
		return channelBalanceResult{}, sanitizeFetchModelsError(err, key)
	}

	body, err := getChannelManagementResponseBody(ctx, http.MethodGet, requestURL, channel, headers, maxAdvancedCustomBalanceResponseBytes)
	if err != nil {
		return channelBalanceResult{}, sanitizeAdvancedCustomRequestError(err, key, requestURL)
	}

	if len(body) > maxAdvancedCustomBalanceResponseBytes {
		return channelBalanceResult{}, fmt.Errorf("balance response exceeds %d bytes", maxAdvancedCustomBalanceResponseBytes)
	}

	var validated json.RawMessage
	if err := common.Unmarshal(body, &validated); err != nil {
		return channelBalanceResult{}, fmt.Errorf("invalid balance JSON response: %w", err)
	}
	if common.GetJsonType(validated) == "object" {
		var creditSummary struct {
			Object         string          `json:"object"`
			TotalAvailable json.RawMessage `json:"total_available"`
		}
		if err := common.Unmarshal(body, &creditSummary); err != nil {
			return channelBalanceResult{}, fmt.Errorf("invalid balance JSON response: %w", err)
		}
		if creditSummary.Object == "credit_summary" &&
			common.GetJsonType(creditSummary.TotalAvailable) == "number" {
			var balance float64
			if err := common.Unmarshal(creditSummary.TotalAvailable, &balance); err == nil &&
				balance >= 0 &&
				!math.IsNaN(balance) &&
				!math.IsInf(balance, 0) {
				if _, err := persistChannelBalance(ctx, channel, balance); err != nil {
					return channelBalanceResult{}, err
				}
				return channelBalanceResult{Balance: balance}, nil
			}
		}
	}

	formatted, err := common.IndentJson(body)
	if err != nil {
		return channelBalanceResult{}, fmt.Errorf("invalid balance JSON response: %w", err)
	}
	return channelBalanceResult{RawResponse: string(formatted)}, nil
}

func updateChannelBalance(ctx context.Context, channel *model.Channel) (channelBalanceResult, error) {
	if channel.Type == constant.ChannelTypeTaskPlugin {
		return channelBalanceResult{}, errors.New("Task plugin channels do not support balance queries")
	}
	if channel.Type == constant.ChannelTypeAdvancedCustom {
		return fetchAdvancedCustomBalance(ctx, channel)
	}
	balance, err := updateStandardChannelBalance(ctx, channel)
	return channelBalanceResult{Balance: balance}, err
}

func updateStandardChannelBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	baseURL := constant.GetChannelBaseURL(channel.Type)
	switch channel.Type {
	case constant.ChannelTypeOpenAI:
		if channel.GetBaseURL() != "" {
			baseURL = channel.GetBaseURL()
		}
	case constant.ChannelTypeAzure:
		return 0, errors.New("尚未实现")
	case constant.ChannelTypeCustom:
		baseURL = channel.GetBaseURL()
	//case common.ChannelTypeOpenAISB:
	//	return updateChannelOpenAISBBalance(channel)
	case constant.ChannelTypeAIProxy:
		return updateChannelAIProxyBalance(ctx, channel)
	case constant.ChannelTypeAPI2GPT:
		return updateChannelAPI2GPTBalance(ctx, channel)
	case constant.ChannelTypeAIGC2D:
		return updateChannelAIGC2DBalance(ctx, channel)
	case constant.ChannelTypeSiliconFlow:
		return updateChannelSiliconFlowBalance(ctx, channel)
	case constant.ChannelTypeDeepSeek:
		return updateChannelDeepSeekBalance(ctx, channel)
	case constant.ChannelTypeOpenRouter:
		return updateChannelOpenRouterBalance(ctx, channel)
	case constant.ChannelTypeMoonshot:
		return updateChannelMoonshotBalance(ctx, channel)
	case constant.ChannelTypeSub2API:
		return updateChannelSub2APIBalance(ctx, channel)
	case constant.ChannelTypeNewAPI:
		return updateChannelNewAPIBalance(ctx, channel)
	default:
		return 0, errors.New("尚未实现")
	}
	url := fmt.Sprintf("%s/v1/dashboard/billing/subscription", baseURL)

	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	subscription := OpenAISubscriptionResponse{}
	err = json.Unmarshal(body, &subscription)
	if err != nil {
		return 0, err
	}
	now := time.Now()
	startDate := fmt.Sprintf("%s-01", now.Format("2006-01"))
	endDate := now.Format("2006-01-02")
	if !subscription.HasPaymentMethod {
		startDate = now.AddDate(0, 0, -100).Format("2006-01-02")
	}
	url = fmt.Sprintf("%s/v1/dashboard/billing/usage?start_date=%s&end_date=%s", baseURL, startDate, endDate)
	body, err = GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	usage := OpenAIUsageResponse{}
	err = json.Unmarshal(body, &usage)
	if err != nil {
		return 0, err
	}
	balance := subscription.HardLimitUSD - usage.TotalUsage/100
	return persistChannelBalance(ctx, channel, balance)
}

func UpdateChannelBalance(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		if err == nil {
			err = errors.New("invalid channel ID")
		}
		common.ApiError(c, err)
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if channel.ChannelInfo.IsMultiKey {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "Multi-key channels do not support balance queries",
		})
		return
	}
	result, err := updateChannelBalance(c.Request.Context(), channel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := gin.H{"success": true, "message": ""}
	if result.RawResponse == "" {
		response["balance"] = result.Balance
		response["balance_updated_time"] = channel.BalanceUpdatedTime
	} else {
		response["raw_response"] = result.RawResponse
	}
	c.JSON(http.StatusOK, response)
}

type channelBalanceSummary struct {
	Updated          int   `json:"updated"`
	RawResponses     int   `json:"raw_responses"`
	Skipped          int   `json:"skipped"`
	FailedChannelIDs []int `json:"failed_channel_ids"`
}

func updateAllChannelsBalance(ctx context.Context) error {
	_, err := queryAllChannelsBalance(ctx)
	return err
}

func queryAllChannelsBalance(ctx context.Context) (channelBalanceSummary, error) {
	summary := channelBalanceSummary{FailedChannelIDs: []int{}}
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return summary, err
	}
	for _, channel := range channels {
		if err := ctx.Err(); err != nil {
			return summary, err
		}
		if channel.Status != common.ChannelStatusEnabled || channel.ChannelInfo.IsMultiKey || channel.Type == constant.ChannelTypeTaskPlugin {
			summary.Skipped++
			continue
		}
		result, err := updateChannelBalance(ctx, channel)
		if err != nil {
			summary.FailedChannelIDs = append(summary.FailedChannelIDs, channel.Id)
			continue
		} else {
			if result.RawResponse == "" {
				summary.Updated++
			} else {
				summary.RawResponses++
			}
			// err is nil & balance <= 0 means quota is used up
			if result.RawResponse == "" && result.Balance <= 0 {
				service.DisableChannel(*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, "", channel.GetAutoBan()), "余额不足")
			}
		}
		if common.RequestInterval > 0 {
			timer := time.NewTimer(common.RequestInterval)
			select {
			case <-ctx.Done():
				timer.Stop()
				return summary, ctx.Err()
			case <-timer.C:
			}
		}
	}
	return summary, nil
}

func UpdateAllChannelsBalance(c *gin.Context) {
	// TODO: make it async
	summary, err := queryAllChannelsBalance(c.Request.Context())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summary,
	})
	return
}

func AutomaticallyUpdateChannels(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Minute)
		common.SysLog("updating all channels")
		_ = updateAllChannelsBalance(context.Background())
		common.SysLog("channels update done")
	}
}

func updateChannelSub2APIBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		return 0, errors.New("Sub2API channel is missing base_url")
	}
	url := fmt.Sprintf("%s/v1/usage", strings.TrimRight(baseURL, "/"))
	body, err := GetResponseBody(ctx, "GET", url, channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}

	type sub2apiUsageResponse struct {
		Balance      *float64 `json:"balance"`
		Remaining    *float64 `json:"remaining"`
		IsValid      *bool    `json:"isValid"`
		Subscription *struct {
			DailyLimitUSD   *float64 `json:"daily_limit_usd"`
			WeeklyLimitUSD  *float64 `json:"weekly_limit_usd"`
			MonthlyLimitUSD *float64 `json:"monthly_limit_usd"`
		} `json:"subscription"`
	}
	usage := sub2apiUsageResponse{}
	if err := common.Unmarshal(body, &usage); err != nil {
		return 0, err
	}
	if usage.IsValid != nil && !*usage.IsValid {
		return 0, errors.New("Sub2API key is invalid (isValid=false)")
	}

	balance := usage.Remaining
	if balance == nil {
		balance = usage.Balance
	}
	if balance == nil {
		return 0, errors.New("Sub2API /v1/usage response is missing remaining and balance fields (the key may belong to a subscription group without an available balance)")
	}
	// Sub2API reports remaining=-1 for a subscription group with no daily, weekly,
	// or monthly limit. A wallet balance can legitimately be negative, so detect
	// the unlimited case from the subscription limits rather than the value.
	subscription := usage.Subscription
	if subscription != nil && subscription.DailyLimitUSD == nil && subscription.WeeklyLimitUSD == nil && subscription.MonthlyLimitUSD == nil {
		return 0, errors.New("Sub2API /v1/usage reports an unlimited subscription without a finite balance")
	}
	return persistChannelBalance(ctx, channel, *balance)
}

// updateChannelNewAPIBalance reads the upstream key's remaining quota. When the
// upstream also returns its owner's quota, the smaller of the two is what the
// key can still spend. Quota converts to USD with the upstream's quota_per_unit.
func updateChannelNewAPIBalance(ctx context.Context, channel *model.Channel) (float64, error) {
	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		return 0, errors.New("New API channel is missing base_url")
	}
	body, err := GetResponseBody(ctx, "GET", baseURL+"/api/usage/token/", channel, GetAuthHeader(channel.Key))
	if err != nil {
		return 0, err
	}
	var usage struct {
		Code    bool   `json:"code"`
		Message string `json:"message"`
		Data    struct {
			TotalAvailable float64 `json:"total_available"`
			UnlimitedQuota bool    `json:"unlimited_quota"`
			UserQuota      *struct {
				TotalAvailable float64 `json:"total_available"`
			} `json:"user_quota"`
		} `json:"data"`
	}
	if err := common.Unmarshal(body, &usage); err != nil {
		return 0, err
	}
	if !usage.Code {
		return 0, fmt.Errorf("New API usage query failed: %s", usage.Message)
	}
	remaining := usage.Data.TotalAvailable
	if usage.Data.UnlimitedQuota {
		remaining = math.Inf(1)
	}
	if userQuota := usage.Data.UserQuota; userQuota != nil {
		remaining = min(remaining, userQuota.TotalAvailable)
	}
	if math.IsInf(remaining, 1) {
		return 0, errors.New(`The upstream key has unlimited quota. Turn on "Allow querying user quota" for this key on the upstream to see the real balance.`)
	}

	body, err = GetResponseBody(ctx, "GET", baseURL+"/api/status", channel, nil)
	if err != nil {
		return 0, err
	}
	var status struct {
		Data struct {
			QuotaPerUnit float64 `json:"quota_per_unit"`
		} `json:"data"`
	}
	if err := common.Unmarshal(body, &status); err != nil {
		return 0, err
	}
	if status.Data.QuotaPerUnit <= 0 {
		return 0, errors.New("New API /api/status response is missing quota_per_unit")
	}
	balance := remaining / status.Data.QuotaPerUnit
	return persistChannelBalance(ctx, channel, balance)
}

func persistChannelBalance(ctx context.Context, channel *model.Channel, balance float64) (float64, error) {
	if err := model.CommitChannelBalanceSnapshot(ctx, channel, balance); err != nil {
		return 0, err
	}
	return balance, nil
}
