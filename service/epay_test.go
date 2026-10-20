package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLegacyEpaySignatureRejectsFieldReinterpretation(t *testing.T) {
	key := "test-payment-key"
	params := map[string]string{"pid": "123", "out_trade_no": "original", "money": "1.00", "trade_status": "TRADE_SUCCESS"}
	params["sign"] = EpaySign(params, key)
	require.True(t, EpayVerify(params, key))
	params["money"] = "2.00"
	require.False(t, EpayVerify(params, key))
	params = map[string]string{"name": "item&out_trade_no=another", "out_trade_no": "original"}
	params["sign"] = EpaySign(params, key)
	require.False(t, EpayVerify(params, key))
	require.False(t, EpayVerify(map[string]string{"sign": EpaySign(map[string]string{}, "")}, ""))
}
