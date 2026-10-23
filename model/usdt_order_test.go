package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func seedUSDTOrder(t *testing.T, trade, gateway string, userID, quota int) {
	t.Helper()
	require.NoError(t, DB.Create(&USDTOrder{TradeNo: trade, GatewayTradeID: gateway, MerchantID: "1000", Currency: "USD", Amount: 10, Quota: quota, Network: "tron", QuotedAmount: "10.0001", ReceiveAddress: "wallet"}).Error)
	require.NoError(t, DB.Create(&TopUp{TradeNo: trade, UserId: userID, Amount: 10, Money: 10, PaymentMethod: "usdt", PaymentProvider: "epusdt", Status: common.TopUpStatusPending}).Error)
}

func TestUSDTSettlementIsAtomicAndIdempotent(t *testing.T) {
	setupSupportPaymentDB(t)
	user := User{Username: "crypto-user", Quota: 100}
	require.NoError(t, DB.Create(&user).Error)
	seedUSDTOrder(t, "first", "gateway-first", user.Id, 500)
	settle := func() (bool, error) {
		return SettleUSDT("first", "gateway-first", "1000", "tron", "wallet", "10", "10.0001", "tx-first")
	}
	var wait sync.WaitGroup
	outcomes := make(chan error, 8)
	for range 8 {
		wait.Add(1)
		go func() { defer wait.Done(); _, err := settle(); outcomes <- err }()
	}
	wait.Wait()
	close(outcomes)
	for err := range outcomes {
		require.NoError(t, err)
	}
	already, err := settle()
	require.NoError(t, err)
	require.True(t, already)
	require.NoError(t, DB.First(&user, user.Id).Error)
	require.Equal(t, 600, user.Quota)
	seedUSDTOrder(t, "second", "gateway-second", user.Id, 500)
	_, err = SettleUSDT("second", "gateway-second", "1000", "tron", "wallet", "10", "10.0001", "tx-first")
	require.Error(t, err)
	require.NoError(t, DB.First(&user, user.Id).Error)
	require.Equal(t, 600, user.Quota)
	require.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo("second").Status)
}

func TestUSDTRejectsIncorrectInvoicesAndWalletOverflow(t *testing.T) {
	setupSupportPaymentDB(t)
	user := User{Username: "crypto-limit", Quota: common.MaxWalletQuota - 10}
	require.NoError(t, DB.Create(&user).Error)
	seedUSDTOrder(t, "invoice", "gateway", user.Id, 500)
	for _, fields := range [][]string{
		{"wrong", "1000", "tron", "wallet", "10", "10.0001", "tx"},
		{"gateway", "wrong", "tron", "wallet", "10", "10.0001", "tx"},
		{"gateway", "1000", "ethereum", "wallet", "10", "10.0001", "tx"},
		{"gateway", "1000", "tron", "wrong", "10", "10.0001", "tx"},
		{"gateway", "1000", "tron", "wallet", "9", "10.0001", "tx"},
		{"gateway", "1000", "tron", "wallet", "10", "10", "tx"},
		{"gateway", "1000", "tron", "wallet", "10", "10.0001", ""},
	} {
		_, err := SettleUSDT("invoice", fields[0], fields[1], fields[2], fields[3], fields[4], fields[5], fields[6])
		require.ErrorIs(t, err, ErrUSDTPaymentMismatch)
	}
	_, err := SettleUSDT("invoice", "gateway", "1000", "tron", "wallet", "10", "10.0001", "tx")
	require.ErrorIs(t, err, ErrTopUpQuotaLimitExceeded)
	require.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo("invoice").Status)
	require.Error(t, ManualCompleteTopUp("invoice", ""))
}

func TestUSDTExpiryIsScopedAndStillAllowsConfirmedDelayedCallbacks(t *testing.T) {
	setupSupportPaymentDB(t)
	user := User{Username: "expired-crypto", Quota: 100}
	require.NoError(t, DB.Create(&user).Error)
	seedUSDTOrder(t, "expired", "expired-provider", user.Id, 500)
	seedUSDTOrder(t, "other-user", "other-provider", user.Id+1, 500)
	require.NoError(t, ExpireUSDTOrders(user.Id))
	require.Equal(t, common.TopUpStatusExpired, GetTopUpByTradeNo("expired").Status)
	require.Equal(t, common.TopUpStatusPending, GetTopUpByTradeNo("other-user").Status)
	_, err := SettleUSDT("expired", "expired-provider", "1000", "tron", "wallet", "10", "10.0001", "delayed-tx")
	require.NoError(t, err)
	require.NoError(t, DB.First(&user, user.Id).Error)
	require.Equal(t, 600, user.Quota)
}
