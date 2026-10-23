package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Crypto quantities are decimal strings; quota is frozen when the order is created.
type USDTOrder struct {
	ID             int    `json:"id"`
	TradeNo        string `json:"trade_no" gorm:"type:varchar(32);uniqueIndex"`
	GatewayTradeID string `json:"gateway_trade_id" gorm:"type:varchar(128);uniqueIndex"`
	GatewayURL     string `json:"-" gorm:"type:varchar(512)"`
	MerchantID     string `json:"-" gorm:"type:varchar(128)"`
	Network        string `json:"network" gorm:"type:varchar(32)"`
	Currency       string `json:"currency" gorm:"type:varchar(8)"`
	Amount         int64  `json:"amount"`
	QuotedAmount   string `json:"quoted_amount" gorm:"type:varchar(64)"`
	ReceiveAddress string `json:"receive_address" gorm:"type:varchar(255)"`
	Quota          int    `json:"quota"`
	ExpiresAt      int64  `json:"expires_at"`
	// NULL until settlement; uniqueness prevents a chain transaction funding two orders.
	TransactionRef *string `json:"transaction_ref" gorm:"type:varchar(255);uniqueIndex"`
}

var ErrUSDTPaymentMismatch = errors.New("USDT payment does not match the order")

func SettleUSDT(tradeNo, gatewayID, merchantID, network, address, amount, actualAmount, transactionID string) (bool, error) {
	alreadyDone := false
	var order USDTOrder
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		var topUp TopUp
		if err := lockForUpdate(tx).Where("trade_no = ?", tradeNo).First(&topUp).Error; err != nil {
			return err
		}
		paid, err := decimal.NewFromString(amount)
		if err != nil {
			return ErrUSDTPaymentMismatch
		}
		actual, err := decimal.NewFromString(actualAmount)
		if err != nil || !actual.IsPositive() {
			return ErrUSDTPaymentMismatch
		}
		quote, quoteErr := decimal.NewFromString(order.QuotedAmount)
		if order.GatewayTradeID != gatewayID || order.MerchantID != merchantID || order.Currency != "USD" || topUp.PaymentProvider != "epusdt" || !paid.Equal(decimal.NewFromInt(order.Amount)) || quoteErr != nil || !actual.Equal(quote) || address != order.ReceiveAddress || network != order.Network || transactionID == "" || len(transactionID) > 200 {
			return ErrUSDTPaymentMismatch
		}
		ref := strings.ToLower(network) + ":" + transactionID
		if topUp.Status == common.TopUpStatusSuccess {
			if order.TransactionRef == nil || *order.TransactionRef != ref {
				return ErrUSDTPaymentMismatch
			}
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending && topUp.Status != common.TopUpStatusExpired {
			return ErrTopUpStatusInvalid
		}
		// Conditional claim also serializes callbacks on databases without row locks.
		claimed := tx.Model(&TopUp{}).Where("id = ? AND status = ?", topUp.Id, topUp.Status).Updates(map[string]any{"status": common.TopUpStatusSuccess, "complete_time": common.GetTimestamp()})
		if claimed.Error != nil {
			return claimed.Error
		}
		if claimed.RowsAffected != 1 {
			return ErrTopUpStatusInvalid
		}
		if err := creditTopUpQuota(tx, topUp.UserId, order.Quota, nil); err != nil {
			return err
		}
		return tx.Model(&order).Updates(map[string]any{"transaction_ref": ref, "network": network, "receive_address": address, "quoted_amount": actual.String()}).Error
	})
	if err == nil && !alreadyDone {
		if topUp := GetTopUpByTradeNo(tradeNo); topUp != nil {
			syncCreditUserQuotaCache(topUp.UserId, order.Quota, "USDT topup")
			RecordTopupLog(topUp.UserId, "USDT top-up completed", "", "usdt", "epusdt")
		}
	}
	return alreadyDone, err
}

func ExpireUSDTOrders(userID int) error {
	expired := DB.Model(&USDTOrder{}).Select("trade_no").Where("expires_at <= ?", common.GetTimestamp())
	query := DB.Model(&TopUp{}).Where("payment_provider = ? AND status = ?", "epusdt", common.TopUpStatusPending).Where("trade_no IN (?)", expired)
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	return query.Update("status", common.TopUpStatusExpired).Error
}
