package service

import (
	"crypto/md5"
	"encoding/hex"
	"net/url"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func GetCallbackAddress() string {
	if operation_setting.CustomCallbackAddress == "" {
		return system_setting.ServerAddress
	}
	return operation_setting.CustomCallbackAddress
}

// epaySignSource 按彩虹易支付规范构造待签名串：
// 剔除 sign / sign_type / 空值，按 key 升序拼接 k=v&k=v（不做 urlencode）。
func epaySignSource(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "sign" || k == "sign_type" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	return strings.Join(parts, "&")
}

// EpaySign 计算易支付 MD5 签名（待签名串末尾直接拼接商户密钥）。
func EpaySign(params map[string]string, key string) string {
	source := epaySignSource(params) + key
	sum := md5.Sum([]byte(source))
	return hex.EncodeToString(sum[:])
}

// EpayVerify 校验回调签名。
func EpayVerify(params map[string]string, key string) bool {
	// Unsigned separators can reinterpret an authenticated field as another key.
	if key == "" {
		return false
	}
	for k, v := range params {
		if strings.ContainsAny(k, "&=") || strings.Contains(v, "&") {
			return false
		}
	}
	got := params["sign"]
	if got == "" {
		return false
	}
	return strings.EqualFold(got, EpaySign(params, key))
}

// BuildEpayPayURL 构造易支付跳转支付链接（submit.php + 已签名参数）。
func BuildEpayPayURL(payAddress, payType, outTradeNo, notifyURL, returnURL, name, money string) string {
	params := map[string]string{
		"pid":          strings.TrimSpace(operation_setting.EpayId),
		"type":         payType,
		"out_trade_no": outTradeNo,
		"notify_url":   notifyURL,
		"return_url":   returnURL,
		"name":         name,
		"money":        money,
	}
	params["sign"] = EpaySign(params, strings.TrimSpace(operation_setting.EpayKey))
	params["sign_type"] = "MD5"

	query := url.Values{}
	for k, v := range params {
		query.Set(k, v)
	}
	base := strings.TrimRight(strings.TrimSpace(payAddress), "/")
	return base + "/submit.php?" + query.Encode()
}

// BuildEpayRedirectURL 构造站内支付入口链接，点击后由 EpayRedirect 校验签名并跳转易支付收银台。
func BuildEpayRedirectURL(serverAddress, payType, outTradeNo string) string {
	params := map[string]string{
		"type":         payType,
		"out_trade_no": outTradeNo,
	}
	params["sign"] = EpaySign(params, strings.TrimSpace(operation_setting.EpayKey))

	query := url.Values{}
	for k, v := range params {
		query.Set(k, v)
	}
	base := strings.TrimRight(strings.TrimSpace(serverAddress), "/")
	return base + "/api/payment/epay/redirect?" + query.Encode()
}
