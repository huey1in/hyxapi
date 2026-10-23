package controller

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func usdtRequest(c *gin.Context) (*system_setting.USDTSettings, int64, int, error) {
	s := *system_setting.GetUSDTSettings()
	if !s.Enabled {
		return nil, 0, 0, errors.New("USDT payments are disabled")
	}
	if err := s.Validate(); err != nil {
		return nil, 0, 0, err
	}
	var req struct {
		Amount int64 `json:"amount"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Amount < s.MinTopUp {
		return nil, 0, 0, errors.New("Invalid USDT top-up amount")
	}
	quota, err := common.WalletQuotaFromDecimalStrict(decimal.NewFromInt(req.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
	if err != nil || quota <= 0 {
		return nil, 0, 0, model.ErrInvalidTopUpQuota
	}
	if err := model.ValidateTopUpQuotaCapacity(c.GetInt("id"), quota); err != nil {
		return nil, 0, 0, err
	}
	return &s, req.Amount, quota, nil
}

func USDTAmount(c *gin.Context) {
	_, amount, _, err := usdtRequest(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "success", "data": decimal.NewFromInt(amount).StringFixed(2)})
}

func USDTCheckout(c *gin.Context) {
	s, amount, quota, err := usdtRequest(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !strings.HasPrefix(system_setting.ServerAddress, "https://") {
		common.ApiError(c, errors.New("USDT requires a public HTTPS site address"))
		return
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		common.ApiError(c, err)
		return
	}
	tradeNo := hex.EncodeToString(random[:])
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	payment, err := service.CreateEpusdtPayment(c.Request.Context(), *s, tradeNo, amount, base+"/api/usdt/notify", base+"/topup")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	actual, actualErr := decimal.NewFromString(payment.ActualAmount.String())
	quoted, quotedErr := decimal.NewFromString(payment.Amount.String())
	if payment.OrderID != tradeNo || payment.TradeID == "" || len(payment.TradeID) > 128 || payment.Status != 1 || !strings.EqualFold(payment.Currency, "USD") || !strings.EqualFold(payment.Token, "USDT") || payment.ReceiveAddress == "" || payment.ExpirationTime <= common.GetTimestamp() || actualErr != nil || !actual.IsPositive() || quotedErr != nil || !quoted.Equal(decimal.NewFromInt(amount)) {
		common.ApiError(c, errors.New("Invalid USDT gateway order"))
		return
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		order := model.USDTOrder{TradeNo: tradeNo, GatewayTradeID: payment.TradeID, GatewayURL: s.GatewayURL, MerchantID: s.MerchantID, Network: s.Network, Currency: "USD", Amount: amount, QuotedAmount: actual.String(), ReceiveAddress: payment.ReceiveAddress, Quota: quota, ExpiresAt: payment.ExpirationTime}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		return tx.Create(&model.TopUp{UserId: c.GetInt("id"), Amount: amount, Money: float64(amount), TradeNo: tradeNo, PaymentMethod: "usdt", PaymentProvider: "epusdt", CreateTime: common.GetTimestamp(), Status: common.TopUpStatusPending}).Error
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	USDTOrderStatusByTrade(c, tradeNo)
}

func USDTNotify(c *gin.Context) {
	// A payment switch only blocks new checkouts; pending orders must still settle.
	s := *system_setting.GetUSDTSettings()
	decoder := json.NewDecoder(io.LimitReader(c.Request.Body, 16385))
	decoder.UseNumber()
	var fields map[string]any
	if decoder.Decode(&fields) != nil || decoder.Decode(new(any)) != io.EOF || !service.VerifyEpusdtSignature(fields, s.APIKey) {
		c.String(http.StatusBadRequest, "invalid signature")
		return
	}
	value := func(key string) string {
		switch v := fields[key].(type) {
		case string:
			return v
		case json.Number:
			return v.String()
		}
		return ""
	}
	var order model.USDTOrder
	if model.DB.Where("trade_no = ?", value("order_id")).First(&order).Error != nil {
		c.String(http.StatusNotFound, "unknown order")
		return
	}
	if order.MerchantID != value("pid") || value("status") != "2" || value("trade_id") != order.GatewayTradeID || !strings.EqualFold(value("token"), "USDT") {
		c.String(http.StatusBadRequest, "order mismatch")
		return
	}
	// Callbacks omit currency/network. Read the final gateway invoice as a second
	// source. This integration pins the token, address, network and quantity.
	invoice, err := service.GetEpusdtPayment(c.Request.Context(), order.GatewayURL, order.GatewayTradeID)
	if err != nil {
		c.String(http.StatusServiceUnavailable, "retry")
		return
	}
	actual, e1 := decimal.NewFromString(value("actual_amount"))
	quoted, e2 := decimal.NewFromString(invoice.ActualAmount.String())
	baseAmount, e3 := decimal.NewFromString(value("amount"))
	invoiceAmount, e4 := decimal.NewFromString(invoice.Amount.String())
	if invoice.TradeID != order.GatewayTradeID || invoice.Status != 2 || !strings.EqualFold(invoice.Currency, "USD") || !strings.EqualFold(invoice.Token, "USDT") || invoice.ReceiveAddress != value("receive_address") || invoice.Network != order.Network || e1 != nil || e2 != nil || e3 != nil || e4 != nil || !actual.Equal(quoted) || !baseAmount.Equal(invoiceAmount) {
		c.String(http.StatusBadRequest, "invoice mismatch")
		return
	}
	_, err = model.SettleUSDT(order.TradeNo, order.GatewayTradeID, value("pid"), invoice.Network, invoice.ReceiveAddress, value("amount"), value("actual_amount"), value("block_transaction_id"))
	if err != nil {
		c.String(http.StatusServiceUnavailable, "retry")
		return
	}
	c.String(http.StatusOK, "ok")
}

func USDTOrderStatus(c *gin.Context) { USDTOrderStatusByTrade(c, c.Param("trade_no")) }

func USDTOrderStatusByTrade(c *gin.Context, tradeNo string) {
	var topUp model.TopUp
	if len(tradeNo) != 32 || model.DB.Where("trade_no = ? AND user_id = ? AND payment_provider = ?", tradeNo, c.GetInt("id"), "epusdt").First(&topUp).Error != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	var order model.USDTOrder
	if err := model.DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if topUp.Status == common.TopUpStatusPending && order.ExpiresAt <= common.GetTimestamp() {
		if err := model.DB.Model(&model.TopUp{}).Where("id = ? AND status = ?", topUp.Id, common.TopUpStatusPending).Update("status", common.TopUpStatusExpired).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		// Re-read because a callback may have completed concurrently.
		if err := model.DB.First(&topUp, topUp.Id).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	}
	common.ApiSuccess(c, gin.H{"trade_no": tradeNo, "status": topUp.Status, "currency": order.Currency, "amount": order.Amount, "token": "USDT", "network": order.Network, "actual_amount": order.QuotedAmount, "receive_address": order.ReceiveAddress, "expires_at": order.ExpiresAt})
}
