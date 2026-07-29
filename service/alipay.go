package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func alipaySignSource(params map[string]string) string {
	return alipayParamsSource(params, true)
}

func alipayParamsSource(params map[string]string, excludeSignType bool) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key != "sign" && (!excludeSignType || key != "sign_type") && value != "" {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+params[key])
	}
	return strings.Join(parts, "&")
}

func alipaySignRequest(params map[string]string, privateKey string) (string, error) {
	key, err := parseAlipayPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(alipayParamsSource(params, false)))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func alipayVerifyRequestSignature(params map[string]string, publicKey string) bool {
	key, err := parseAlipayPublicKey(publicKey)
	if err != nil {
		return false
	}
	signature, err := base64.StdEncoding.DecodeString(params["sign"])
	if err != nil {
		return false
	}
	digest := sha256.Sum256([]byte(alipayParamsSource(params, false)))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature) == nil
}

func decodeAlipayKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if block, _ := pem.Decode([]byte(raw)); block != nil {
		return block.Bytes, nil
	}
	return base64.StdEncoding.DecodeString(strings.Join(strings.Fields(raw), ""))
}

func parseAlipayPrivateKey(raw string) (*rsa.PrivateKey, error) {
	der, err := decodeAlipayKey(raw)
	if err != nil {
		return nil, err
	}
	if key, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	return x509.ParsePKCS1PrivateKey(der)
}

func parseAlipayPublicKey(raw string) (*rsa.PublicKey, error) {
	der, err := decodeAlipayKey(raw)
	if err != nil {
		return nil, err
	}
	if key, err := x509.ParsePKIXPublicKey(der); err == nil {
		if rsaKey, ok := key.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	return x509.ParsePKCS1PublicKey(der)
}

func AlipaySign(params map[string]string, privateKey string) (string, error) {
	key, err := parseAlipayPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(alipaySignSource(params)))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func AlipayVerify(params map[string]string, publicKey string) bool {
	key, err := parseAlipayPublicKey(publicKey)
	if err != nil {
		return false
	}
	signature, err := base64.StdEncoding.DecodeString(params["sign"])
	if err != nil {
		return false
	}
	digest := sha256.Sum256([]byte(alipaySignSource(params)))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature) == nil
}

func BuildAlipayPayURL(outTradeNo, notifyURL, returnURL, subject, amount string) (string, error) {
	gateway := strings.TrimSpace(operation_setting.AlipayGateway)
	if gateway == "" {
		return "", errors.New("missing alipay gateway")
	}
	biz, _ := json.Marshal(map[string]string{
		"out_trade_no": outTradeNo, "product_code": "FAST_INSTANT_TRADE_PAY",
		"total_amount": amount, "subject": subject,
	})
	params := map[string]string{
		"app_id": strings.TrimSpace(operation_setting.AlipayAppId), "method": "alipay.trade.page.pay",
		"format": "JSON", "charset": "utf-8", "sign_type": "RSA2",
		"timestamp": time.Now().Format("2006-01-02 15:04:05"), "version": "1.0",
		"notify_url": notifyURL, "return_url": returnURL, "biz_content": string(biz),
	}
	signature, err := alipaySignRequest(params, operation_setting.AlipayPrivateKey)
	if err != nil {
		return "", err
	}
	values := url.Values{}
	for key, value := range params {
		values.Set(key, value)
	}
	values.Set("sign", signature)
	separator := "?"
	if strings.Contains(gateway, "?") {
		separator = "&"
	}
	return gateway + separator + values.Encode(), nil
}
