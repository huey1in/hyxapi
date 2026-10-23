package controller

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type alipayCheckoutRequest struct {
	Amount int `json:"amount"`
}

func RequestAlipayCheckout(c *gin.Context) {
	if !operation_setting.AlipayEnabled {
		common.ApiErrorMsg(c, "支付宝电脑网站支付未启用")
		return
	}
	var req alipayCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Amount < operation_setting.MinTopUp {
		common.ApiErrorMsg(c, fmt.Sprintf("充值数量不能低于 %d", operation_setting.MinTopUp))
		return
	}
	if rejectInvalidCreditedQuota(c, c.GetInt("id"), decimal.NewFromInt(int64(req.Amount)).Mul(decimal.NewFromFloat(common.QuotaPerUnit))) {
		return
	}
	money := decimal.NewFromInt(int64(req.Amount)).Mul(decimal.NewFromFloat(operation_setting.Price))
	tradeNo := common.GetUUID()
	topUp := &model.TopUp{UserId: c.GetInt("id"), Amount: int64(req.Amount), Money: money.InexactFloat64(), TradeNo: tradeNo, PaymentMethod: model.PaymentMethodAlipay, PaymentProvider: model.PaymentProviderAlipay, CreateTime: common.GetTimestamp(), Status: common.TopUpStatusPending}
	if err := topUp.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	callbackBase := strings.TrimRight(service.GetCallbackAddress(), "/")
	returnBase := strings.TrimRight(system_setting.ServerAddress, "/")
	payURL, err := service.BuildAlipayPayURL(tradeNo, callbackBase+"/api/payment/alipay/notify", returnBase+"/api/payment/alipay/return", "额度充值", money.StringFixed(2))
	if err != nil {
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentMethodAlipay, common.TopUpStatusFailed)
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"pay_url": payURL, "trade_no": tradeNo})
}

func alipayRequestParams(c *gin.Context) map[string]string {
	params := make(map[string]string)
	for key, values := range c.Request.Form {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	return params
}

func AlipayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusOK, "failure")
		return
	}
	params := alipayRequestParams(c)
	tradeNo := strings.TrimSpace(params["out_trade_no"])
	status := params["trade_status"]
	if !service.AlipayVerify(params, operation_setting.AlipayPublicKey) || params["app_id"] != strings.TrimSpace(operation_setting.AlipayAppId) || (status != "TRADE_SUCCESS" && status != "TRADE_FINISHED") || tradeNo == "" {
		common.SysError("alipay notify validation failed, trade_no: " + tradeNo)
		c.String(http.StatusOK, "failure")
		return
	}
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.PaymentMethod != model.PaymentMethodAlipay {
		c.String(http.StatusOK, "failure")
		return
	}
	paid, err := decimal.NewFromString(params["total_amount"])
	expected := decimal.NewFromFloat(topUp.Money).Round(2)
	if err != nil || !paid.Round(2).Equal(expected) {
		c.String(http.StatusOK, "failure")
		return
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteOnlineTopUp(tradeNo, model.PaymentMethodAlipay, c.ClientIP()); err != nil {
		common.SysError("alipay notify complete failed: " + err.Error())
		c.String(http.StatusOK, "failure")
		return
	}
	c.String(http.StatusOK, "success")
}

func AlipayReturn(c *gin.Context) {
	params := make(map[string]string)
	for key, values := range c.Request.URL.Query() {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	if !service.AlipayVerify(params, operation_setting.AlipayPublicKey) || params["app_id"] != strings.TrimSpace(operation_setting.AlipayAppId) {
		c.String(http.StatusBadRequest, "invalid alipay return")
		return
	}
	c.Redirect(http.StatusFound, strings.TrimRight(system_setting.ServerAddress, "/")+"/topup")
}

// epayMethodMinTopUp 返回指定支付方式的最低充值数量；
// 找不到该方式返回 (0, false)，方式存在但未单独配置 min_topup 时回退到全局 MinTopUp。
func epayMethodMinTopUp(payType string) (int, bool) {
	for _, m := range operation_setting.PayMethods {
		if m["type"] != payType {
			continue
		}
		if mt := strings.TrimSpace(m["min_topup"]); mt != "" {
			if v, err := decimal.NewFromString(mt); err == nil {
				return int(v.IntPart()), true
			}
		}
		return operation_setting.MinTopUp, true
	}
	return 0, false
}

// RequestAlipayAmount quotes the legacy USD-unit purchase contract.
func RequestAlipayAmount(c *gin.Context) {
	var req alipayCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Amount < operation_setting.MinTopUp {
		common.ApiErrorMsg(c, fmt.Sprintf("充值数量不能低于 %d", operation_setting.MinTopUp))
		return
	}
	if rejectInvalidCreditedQuota(c, c.GetInt("id"), decimal.NewFromInt(int64(req.Amount)).Mul(decimal.NewFromFloat(common.QuotaPerUnit))) {
		return
	}
	common.ApiSuccess(c, decimal.NewFromInt(int64(req.Amount)).Mul(decimal.NewFromFloat(operation_setting.Price)).StringFixed(2))
}
