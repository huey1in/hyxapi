package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
)

func paymentFixture(t *testing.T) *model.User {
	t.Helper()
	db := setupRelayIntegrationDB(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}, &model.SubscriptionOrder{}))
	user := &model.User{Id: 88911, Username: "payments-controller", Group: "default", Quota: 10, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	return user
}

func paymentRequest(t *testing.T, handler gin.HandlerFunc, userID int, body, signature string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("id", userID)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/payment-fixture", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Stripe-Signature", signature)
	ctx.Request.Header.Set(CreemSignatureHeader, signature)
	handler(ctx)
	return recorder
}

func stripeSignature(body, secret string) string {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(timestamp + "." + body))
	return "t=" + timestamp + ",v1=" + hex.EncodeToString(mac.Sum(nil))
}

func TestWaffoMinimumTopUpUsesCreditUnitsInAllDisplayModes(t *testing.T) {
	user := paymentFixture(t)
	previousDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	previousWaffoMin, previousPancakeMin := setting.WaffoMinTopUp, setting.WaffoPancakeMinTopUp
	previousEnabled, previousSandbox := setting.WaffoEnabled, setting.WaffoSandbox
	previousKey, previousPrivate, previousCert := setting.WaffoSandboxApiKey, setting.WaffoSandboxPrivateKey, setting.WaffoSandboxPublicCert
	previousMerchant, previousPancakeKey, previousProduct := setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey, setting.WaffoPancakeProductID
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = previousDisplay
		setting.WaffoMinTopUp, setting.WaffoPancakeMinTopUp = previousWaffoMin, previousPancakeMin
		setting.WaffoEnabled, setting.WaffoSandbox = previousEnabled, previousSandbox
		setting.WaffoSandboxApiKey, setting.WaffoSandboxPrivateKey, setting.WaffoSandboxPublicCert = previousKey, previousPrivate, previousCert
		setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey, setting.WaffoPancakeProductID = previousMerchant, previousPancakeKey, previousProduct
	})
	setting.WaffoMinTopUp, setting.WaffoPancakeMinTopUp = 10, 10
	setting.WaffoEnabled, setting.WaffoSandbox = true, true
	setting.WaffoSandboxApiKey, setting.WaffoSandboxPrivateKey, setting.WaffoSandboxPublicCert = "fixture", "fixture", "fixture"
	setting.WaffoPancakeMerchantID, setting.WaffoPancakePrivateKey, setting.WaffoPancakeProductID = "fixture", "fixture", "fixture"
	for _, display := range []string{operation_setting.QuotaDisplayTypeUSD, operation_setting.QuotaDisplayTypeTokens} {
		t.Run(display, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = display
			belowMinimum := int64(9)
			if display == operation_setting.QuotaDisplayTypeTokens {
				belowMinimum = int64(common.QuotaPerUnit*10) - 1
			}
			for _, handler := range []gin.HandlerFunc{RequestWaffoAmount, RequestWaffoPay, RequestWaffoPancakeAmount, RequestWaffoPancakePay} {
				for _, amount := range []int64{-1, 0, belowMinimum} {
					response := paymentRequest(t, handler, user.Id, fmt.Sprintf(`{"amount":%d}`, amount), "")
					require.Contains(t, response.Body.String(), `"message":"error"`)
					require.Contains(t, response.Body.String(), "Top-up amount cannot be less than")
				}
			}
		})
	}
	var count int64
	require.NoError(t, model.DB.Model(&model.TopUp{}).Count(&count).Error)
	require.Zero(t, count, "rejected amounts must not create payment orders")
}

func TestStripeTokensCheckoutUsesQuotedWholeQuantity(t *testing.T) {
	user := paymentFixture(t)
	previousKey, previousSecret, previousPrice := setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId
	previousUnit, previousMin := setting.StripeUnitPrice, setting.StripeMinTopUp
	previousDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	backend := stripe.GetBackend(stripe.APIBackend)
	t.Cleanup(func() {
		setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = previousKey, previousSecret, previousPrice
		setting.StripeUnitPrice, setting.StripeMinTopUp = previousUnit, previousMin
		operation_setting.GetGeneralSetting().QuotaDisplayType = previousDisplay
		stripe.SetBackend(stripe.APIBackend, backend)
	})
	setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = "sk_test_fixture", "whsec_fixture", "price_fixture"
	setting.StripeUnitPrice, setting.StripeMinTopUp = 2.5, 1
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	var quantity string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		quantity = r.Form.Get("line_items[0][quantity]")
		require.Equal(t, "price_fixture", r.Form.Get("line_items[0][price]"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"cs_fixture","object":"checkout.session","url":"https://checkout.stripe.com/fixture"}`))
	}))
	defer server.Close()
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{URL: stripe.String(server.URL), HTTPClient: server.Client()}))
	body := fmt.Sprintf(`{"amount":%d,"payment_method":"stripe"}`, int64(common.QuotaPerUnit*20))
	quote := paymentRequest(t, RequestStripeAmount, user.Id, body, "")
	require.JSONEq(t, `{"message":"success","data":"50.00"}`, quote.Body.String())
	checkout := paymentRequest(t, RequestStripePay, user.Id, body, "")
	require.Contains(t, checkout.Body.String(), "checkout.stripe.com/fixture")
	require.Equal(t, "20", quantity, "Stripe must receive credit units, never the raw TOKENS display amount")
	var order model.TopUp
	require.NoError(t, model.DB.Where("user_id = ?", user.Id).First(&order).Error)
	require.EqualValues(t, 20, order.Amount)
	require.EqualValues(t, 20, order.Money, "Money retains the credited USD-unit snapshot")
	for _, amount := range []int64{0, -500000, int64(common.QuotaPerUnit) - 1} {
		result := paymentRequest(t, RequestStripePay, user.Id, fmt.Sprintf(`{"amount":%d,"payment_method":"stripe"}`, amount), "")
		require.Contains(t, result.Body.String(), `"success":false`)
	}
}

func TestStripeSignedWebhooksCreditOnceAndRetryFailedSettlement(t *testing.T) {
	user := paymentFixture(t)
	previousKey, previousSecret, previousPrice := setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = previousKey, previousSecret, previousPrice
	})
	setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = "sk_test_fixture", "whsec_fixture", ""
	order := &model.TopUp{UserId: user.Id, Amount: 2, Money: 2, TradeNo: "stripe-signed-fixture", PaymentMethod: model.PaymentMethodStripe, PaymentProvider: model.PaymentProviderStripe, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	payload := func(reference string) string {
		data, err := json.Marshal(map[string]any{"id": "evt_fixture", "object": "event", "type": "checkout.session.completed", "data": map[string]any{"object": map[string]any{"id": "cs_fixture", "status": "complete", "payment_status": "paid", "client_reference_id": reference, "amount_total": 200, "currency": "usd"}}})
		require.NoError(t, err)
		return string(data)
	}
	body := payload(order.TradeNo)
	require.Equal(t, http.StatusBadRequest, paymentRequest(t, StripeWebhook, user.Id, body, "invalid").Code)
	for range 2 {
		require.Equal(t, http.StatusOK, paymentRequest(t, StripeWebhook, user.Id, body, stripeSignature(body, setting.StripeWebhookSecret)).Code)
	}
	var updated model.User
	require.NoError(t, model.DB.First(&updated, user.Id).Error)
	require.Equal(t, 10+int(common.QuotaPerUnit*2), updated.Quota)
	failed := &model.TopUp{UserId: user.Id, Amount: 1, Money: 1, TradeNo: "stripe-capacity-fixture", PaymentMethod: model.PaymentMethodStripe, PaymentProvider: model.PaymentProviderStripe, Status: common.TopUpStatusPending}
	require.NoError(t, failed.Insert())
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", user.Id).Update("quota", common.MaxWalletQuota).Error)
	body = payload(failed.TradeNo)
	require.Equal(t, http.StatusInternalServerError, paymentRequest(t, StripeWebhook, user.Id, body, stripeSignature(body, setting.StripeWebhookSecret)).Code)
	require.Equal(t, common.TopUpStatusPending, model.GetTopUpByTradeNo(failed.TradeNo).Status)
}

func TestCreemSignedWebhooksKeepRawQuotaAndSupportSubscriptionOnlyConfig(t *testing.T) {
	user := paymentFixture(t)
	key, secret, products := setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts
	t.Cleanup(func() { setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts = key, secret, products })
	setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts = "fixture", "creem-secret", "[]"
	order := &model.TopUp{UserId: user.Id, Amount: 1250000, Money: 2.5, TradeNo: "creem-signed-fixture", PaymentMethod: model.PaymentMethodCreem, PaymentProvider: model.PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	body := `{"id":"evt_fixture","eventType":"checkout.completed","object":{"request_id":"creem-signed-fixture","order":{"status":"paid","type":"onetime","amount_paid":250,"currency":"USD"},"customer":{"email":"fixture@example.com"}}}`
	require.Equal(t, http.StatusUnauthorized, paymentRequest(t, CreemWebhook, user.Id, body, "wrong").Code)
	for range 2 {
		require.Equal(t, http.StatusOK, paymentRequest(t, CreemWebhook, user.Id, body, generateCreemSignature(body, setting.CreemWebhookSecret)).Code)
	}
	var updated model.User
	require.NoError(t, model.DB.First(&updated, user.Id).Error)
	require.Equal(t, 1250010, updated.Quota)
}

func TestLegacyEpayCallbacksValidateMerchantAmountAndCreditOnce(t *testing.T) {
	user := paymentFixture(t)
	previousID, previousKey := operation_setting.EpayId, operation_setting.EpayKey
	t.Cleanup(func() { operation_setting.EpayId, operation_setting.EpayKey = previousID, previousKey })
	operation_setting.EpayId, operation_setting.EpayKey = "12345", "legacy-epay-fixture"
	order := &model.TopUp{UserId: user.Id, Amount: 2, Money: 4, TradeNo: "legacy-epay-signed", PaymentMethod: model.PaymentMethodEpay, PaymentProvider: model.PaymentProviderEpay, Status: common.TopUpStatusPending}
	require.NoError(t, order.Insert())
	callback := func(pid, amount string) string {
		fields := map[string]string{"pid": pid, "money": amount, "out_trade_no": order.TradeNo, "trade_status": "TRADE_SUCCESS"}
		fields["sign"] = service.EpaySign(fields, operation_setting.EpayKey)
		values := url.Values{}
		for key, value := range fields {
			values.Set(key, value)
		}
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodPost, "/api/payment/epay/notify", strings.NewReader(values.Encode()))
		ctx.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		LegacyEpayNotify(ctx)
		return recorder.Body.String()
	}
	require.Equal(t, "fail", callback("another-merchant", "4.00"))
	require.Equal(t, "fail", callback(operation_setting.EpayId, "0.01"))
	require.Equal(t, common.TopUpStatusPending, model.GetTopUpByTradeNo(order.TradeNo).Status)
	for range 2 {
		require.Equal(t, "success", callback(operation_setting.EpayId, "4.00"))
	}
	var updated model.User
	require.NoError(t, model.DB.First(&updated, user.Id).Error)
	require.Equal(t, 10+int(2*common.QuotaPerUnit), updated.Quota)
}
