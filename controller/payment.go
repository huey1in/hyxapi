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

type epayCheckoutRequest struct {
	Amount int    `json:"amount"`
	Type   string `json:"type"`
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

// RequestEpayCheckout 创建易支付订单并返回站内支付入口链接。
func RequestEpayCheckout(c *gin.Context) {
	if !operation_setting.EpayEnabled {
		common.ApiErrorMsg(c, "易支付未启用")
		return
	}

	var req epayCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	minTopUp, ok := epayMethodMinTopUp(req.Type)
	if !ok {
		common.ApiErrorMsg(c, "不支持的支付方式")
		return
	}
	if req.Amount < minTopUp {
		common.ApiErrorMsg(c, fmt.Sprintf("充值数量不能低于 %d", minTopUp))
		return
	}

	userId := c.GetInt("id")

	money := decimal.NewFromInt(int64(req.Amount)).Mul(decimal.NewFromFloat(operation_setting.Price))
	outTradeNo := common.GetUUID()

	topUp := &model.TopUp{
		UserId:        userId,
		Amount:        int64(req.Amount),
		Money:         money.InexactFloat64(),
		TradeNo:       outTradeNo,
		PaymentMethod: model.PaymentMethodEpay,
		CreateTime:    common.GetTimestamp(),
		Status:        common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}

	notifyURL := strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/payment/epay/notify"
	returnURL := strings.TrimRight(system_setting.ServerAddress, "/") + "/console/topup"
	epayURL := service.BuildEpayPayURL(operation_setting.PayAddress, req.Type, outTradeNo, notifyURL, returnURL, "额度充值", money.StringFixed(2))
	payURL := service.BuildEpayRedirectURL(system_setting.ServerAddress, req.Type, outTradeNo)

	payload := gin.H{
		"pay_url":  payURL,
		"trade_no": outTradeNo,
	}
	if qr, err := service.FetchEpayConsoleQRCode(operation_setting.PayAddress, epayURL, outTradeNo); err == nil && qr != nil {
		payload["qr_url"] = qr.QRURL
		payload["qr_value"] = qr.QRValue
		payload["h5_url"] = qr.H5URL
		payload["expires_in"] = qr.RemainingSeconds
		payload["epay_status"] = qr.Code
		payload["epay_message"] = qr.Message
	} else if err != nil {
		common.SysError("epay qr fetch failed: " + err.Error())
	}

	common.ApiSuccess(c, payload)
}

// EpayRedirect 校验站内支付入口后跳转到易支付收银台。
func EpayRedirect(c *gin.Context) {
	if !operation_setting.EpayEnabled {
		c.String(http.StatusBadRequest, "payment disabled")
		return
	}

	payType := strings.TrimSpace(c.Query("type"))
	tradeNo := strings.TrimSpace(c.Query("out_trade_no"))
	sign := strings.TrimSpace(c.Query("sign"))
	if payType == "" || tradeNo == "" || sign == "" {
		c.String(http.StatusBadRequest, "invalid payment link")
		return
	}
	if _, ok := epayMethodMinTopUp(payType); !ok {
		c.String(http.StatusBadRequest, "unsupported payment type")
		return
	}
	if !service.EpayVerify(map[string]string{
		"type":         payType,
		"out_trade_no": tradeNo,
		"sign":         sign,
	}, strings.TrimSpace(operation_setting.EpayKey)) {
		c.String(http.StatusBadRequest, "invalid signature")
		return
	}

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.PaymentMethod != model.PaymentMethodEpay {
		c.String(http.StatusNotFound, "payment order not found")
		return
	}
	if topUp.Status != common.TopUpStatusPending {
		c.Redirect(http.StatusFound, strings.TrimRight(system_setting.ServerAddress, "/")+"/console/topup")
		return
	}

	moneyStr := decimal.NewFromFloat(topUp.Money).StringFixed(2)
	notifyURL := strings.TrimRight(service.GetCallbackAddress(), "/") + "/api/payment/epay/notify"
	returnURL := strings.TrimRight(system_setting.ServerAddress, "/") + "/console/topup"
	payURL := service.BuildEpayPayURL(operation_setting.PayAddress, payType, tradeNo, notifyURL, returnURL, "额度充值", moneyStr)
	c.Redirect(http.StatusFound, payURL)
}

// EpayNotify 接收易支付异步通知（公开路由），校验签名后完成订单充值。
// 易支付要求成功时返回纯文本 "success"，失败返回 "fail"。
func EpayNotify(c *gin.Context) {
	params := make(map[string]string)
	for k, v := range c.Request.URL.Query() {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	if !service.EpayVerify(params, strings.TrimSpace(operation_setting.EpayKey)) {
		common.SysError("epay notify verify failed, trade_no: " + params["out_trade_no"])
		c.String(http.StatusOK, "fail")
		return
	}

	if params["trade_status"] != "TRADE_SUCCESS" {
		c.String(http.StatusOK, "success")
		return
	}

	tradeNo := params["out_trade_no"]
	if tradeNo == "" {
		c.String(http.StatusOK, "fail")
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.CompleteEpayTopUp(tradeNo, c.ClientIP()); err != nil {
		common.SysError("epay notify complete failed: " + err.Error())
		c.String(http.StatusOK, "fail")
		return
	}

	c.String(http.StatusOK, "success")
}
