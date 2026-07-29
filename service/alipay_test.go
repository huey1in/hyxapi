package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func testAlipayKeys(t *testing.T) (string, string) {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: mustMarshalPKCS8(t, privateKey)})
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: x509.MarshalPKCS1PublicKey(&privateKey.PublicKey)})
	return string(privatePEM), string(publicPEM)
}

func TestBuildAlipayPayURLSignsRequestIncludingSignType(t *testing.T) {
	privateKey, publicKey := testAlipayKeys(t)
	oldAppID, oldPrivateKey, oldGateway := operation_setting.AlipayAppId, operation_setting.AlipayPrivateKey, operation_setting.AlipayGateway
	t.Cleanup(func() {
		operation_setting.AlipayAppId, operation_setting.AlipayPrivateKey, operation_setting.AlipayGateway = oldAppID, oldPrivateKey, oldGateway
	})
	operation_setting.AlipayAppId = "20260001"
	operation_setting.AlipayPrivateKey = privateKey
	operation_setting.AlipayGateway = "https://openapi.alipay.test/gateway.do"
	payURL, err := BuildAlipayPayURL("R005", "https://example.com/notify", "https://example.com/return", "额度充值", "10.00")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(payURL)
	if err != nil {
		t.Fatal(err)
	}
	params := make(map[string]string)
	for key, values := range parsed.Query() {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	if !alipayVerifyRequestSignature(params, publicKey) {
		t.Fatal("payment request signature must cover sign_type")
	}
}

func mustMarshalPKCS8(t *testing.T, key *rsa.PrivateKey) []byte {
	t.Helper()
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	return der
}

func TestAlipayRSA2SignAndVerify(t *testing.T) {
	privateKey, publicKey := testAlipayKeys(t)
	params := map[string]string{"app_id": "20260001", "method": "alipay.trade.page.pay", "biz_content": `{"out_trade_no":"R001"}`}
	signature, err := AlipaySign(params, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	params["sign"] = signature
	if !AlipayVerify(params, publicKey) {
		t.Fatal("expected valid RSA2 signature")
	}
}

func TestAlipayVerifyIgnoresSignMetadata(t *testing.T) {
	privateKey, publicKey := testAlipayKeys(t)
	params := map[string]string{"app_id": "20260001", "trade_status": "TRADE_SUCCESS", "out_trade_no": "R002"}
	signature, err := AlipaySign(params, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	params["sign"] = signature
	params["sign_type"] = "RSA2"
	if !AlipayVerify(params, publicKey) {
		t.Fatal("sign and sign_type must not be included in verification source")
	}
}

func TestAlipayVerifyRejectsTamperedParameters(t *testing.T) {
	privateKey, publicKey := testAlipayKeys(t)
	params := map[string]string{"out_trade_no": "R003", "total_amount": "10.00"}
	signature, err := AlipaySign(params, privateKey)
	if err != nil {
		t.Fatal(err)
	}
	params["sign"] = signature
	params["total_amount"] = "100.00"
	if AlipayVerify(params, publicKey) {
		t.Fatal("tampered payment amount must fail verification")
	}
}

func TestAlipayAcceptsBareBase64Keys(t *testing.T) {
	privateKey, publicKey := testAlipayKeys(t)
	privateBlock, _ := pem.Decode([]byte(privateKey))
	publicBlock, _ := pem.Decode([]byte(publicKey))
	params := map[string]string{"out_trade_no": "R004"}
	signature, err := AlipaySign(params, base64.StdEncoding.EncodeToString(privateBlock.Bytes))
	if err != nil {
		t.Fatal(err)
	}
	params["sign"] = signature
	if !AlipayVerify(params, base64.StdEncoding.EncodeToString(publicBlock.Bytes)) {
		t.Fatal("bare base64 key material should be accepted")
	}
}
