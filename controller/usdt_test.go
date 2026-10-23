package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUSDTCheckoutWebhookAndOwnership(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}, &model.USDTOrder{}))
	require.NoError(t, model.LOG_DB.AutoMigrate(&model.Log{}))
	oldSettings, oldAddress, oldTransport := *system_setting.GetUSDTSettings(), system_setting.ServerAddress, http.DefaultTransport
	t.Cleanup(func() {
		*system_setting.GetUSDTSettings(), system_setting.ServerAddress, http.DefaultTransport = oldSettings, oldAddress, oldTransport
	})
	var invoice map[string]any
	var callback map[string]any
	reads := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			require.Equal(t, "/payments/gmpay/v1/order/create-transaction", r.URL.Path)
			decoder := json.NewDecoder(r.Body)
			decoder.UseNumber()
			var fields map[string]any
			require.NoError(t, decoder.Decode(&fields))
			require.True(t, service.VerifyEpusdtSignature(fields, "merchant-secret"))
			require.Equal(t, "usd", fields["currency"])
			require.Equal(t, "usdt", fields["token"])
			require.Equal(t, "https://site.example/api/usdt/notify", fields["notify_url"])
			invoice = map[string]any{"trade_id": "provider-1", "order_id": fields["order_id"], "amount": 10, "currency": "USD", "token": "USDT", "network": "tron", "actual_amount": 10.0001, "receive_address": "wallet", "status": 1, "expiration_time": common.GetTimestamp() + 600}
			callback = map[string]any{"pid": "1000", "trade_id": "provider-1", "order_id": fields["order_id"], "amount": 10, "actual_amount": json.Number("10.0001"), "receive_address": "wallet", "token": "USDT", "status": 2, "block_transaction_id": "chain-transaction"}
		} else {
			reads++
			require.Equal(t, "/pay/checkout-counter-resp/provider-1", r.URL.Path)
		}
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"status_code": 200, "data": invoice}))
	}))
	defer server.Close()
	http.DefaultTransport = server.Client().Transport
	*system_setting.GetUSDTSettings() = system_setting.USDTSettings{Enabled: true, GatewayURL: server.URL, MerchantID: "1000", APIKey: "merchant-secret", Network: "tron", MinTopUp: 5}
	system_setting.ServerAddress = "https://site.example"
	response := securityEnrollmentRequest("POST", "/api/user/usdt/pay", `{"amount":10}`, "", identity, USDTCheckout)
	var created struct {
		Success bool `json:"success"`
		Data    struct {
			TradeNo      string `json:"trade_no"`
			ActualAmount string `json:"actual_amount"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &created))
	require.True(t, created.Success, response.Body.String())
	require.Len(t, created.Data.TradeNo, 32)
	require.Equal(t, "10.0001", created.Data.ActualAmount)
	require.NotContains(t, response.Body.String(), "merchant-secret")
	require.NotContains(t, response.Body.String(), "provider-1")
	status := func(caller int) *httptest.ResponseRecorder {
		return securityEnrollmentRequest("GET", "/api/user/usdt/orders/"+created.Data.TradeNo, "", "", identity, func(c *gin.Context) {
			c.Set("id", caller)
			c.Params = gin.Params{{Key: "trade_no", Value: created.Data.TradeNo}}
			USDTOrderStatus(c)
		})
	}
	require.Equal(t, http.StatusNotFound, status(user.Id+1).Code)
	require.Equal(t, http.StatusOK, status(user.Id).Code)
	notify := func() *httptest.ResponseRecorder {
		signature, err := service.EpusdtSignature(callback, "merchant-secret")
		require.NoError(t, err)
		callback["signature"] = signature
		body, err := json.Marshal(callback)
		require.NoError(t, err)
		return securityEnrollmentRequest("POST", "/api/usdt/notify", string(body), "", service.AuthIdentity{}, USDTNotify)
	}
	// Valid signatures cannot settle pending gateway invoices.
	require.Equal(t, http.StatusBadRequest, notify().Code)
	invoice["status"] = 2
	callback["amount"] = 9
	require.Equal(t, http.StatusBadRequest, notify().Code)
	callback["amount"] = 10
	// Disabling checkout must not discard callbacks for already-created invoices.
	system_setting.GetUSDTSettings().Enabled = false
	before := user.Quota
	require.Equal(t, "ok", notify().Body.String())
	require.Equal(t, "ok", notify().Body.String())
	require.NoError(t, model.DB.First(user, user.Id).Error)
	require.Equal(t, before+int(10*common.QuotaPerUnit), user.Quota)
	require.Equal(t, common.TopUpStatusSuccess, model.GetTopUpByTradeNo(created.Data.TradeNo).Status)
	previousReads := reads
	response = securityEnrollmentRequest("POST", "/api/usdt/notify", `{"signature":"bad","order_id":"fake"}`, "", service.AuthIdentity{}, USDTNotify)
	require.Equal(t, http.StatusBadRequest, response.Code)
	require.Equal(t, previousReads, reads)
}
