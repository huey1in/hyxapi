package service

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

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

// BuildEpayRedirectURL 构造站内支付入口链接，用于二维码展示。
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

type EpayConsoleQRCode struct {
	Code             int    `json:"code"`
	Message          string `json:"msg"`
	QRURL            string `json:"qr_url"`
	QRValue          string `json:"qr_value"`
	H5URL            string `json:"h5_qrurl"`
	URL              string `json:"url"`
	RemainingSeconds int    `json:"remaining_seconds"`
}

// FetchEpayConsoleQRCode initializes the third-party cashier page, then reads
// the QR image URL from the page's own polling API.
func FetchEpayConsoleQRCode(payAddress, payURL, outTradeNo string) (*EpayConsoleQRCode, error) {
	if strings.TrimSpace(payURL) == "" || strings.TrimSpace(outTradeNo) == "" {
		return nil, fmt.Errorf("missing epay pay url or trade no")
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Timeout: 12 * time.Second,
		Jar:     jar,
	}

	initReq, err := http.NewRequest(http.MethodGet, payURL, nil)
	if err != nil {
		return nil, err
	}
	initReq.Header.Set("User-Agent", "Mozilla/5.0")
	initResp, err := client.Do(initReq)
	if err != nil {
		return nil, err
	}
	finalURL := initResp.Request.URL.String()
	initBody, _ := io.ReadAll(io.LimitReader(initResp.Body, 1<<20))
	_ = initResp.Body.Close()
	if initResp.StatusCode < http.StatusOK || initResp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("epay cashier returned status %d", initResp.StatusCode)
	}
	remainingSeconds := extractEpayRemainingSeconds(string(initBody))
	if remainingSeconds <= 0 {
		remainingSeconds = 180
	}

	base := strings.TrimRight(strings.TrimSpace(payAddress), "/")
	apiURL := base + "/Pay/ConSole?TradeNo=" + url.QueryEscape(outTradeNo) + "&v=" + fmt.Sprintf("%d", time.Now().UnixMilli())
	for i := 0; i < 3; i++ {
		req, err := http.NewRequest(http.MethodGet, apiURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0")
		req.Header.Set("Accept", "application/json, text/javascript, */*; q=0.01")
		req.Header.Set("X-Requested-With", "XMLHttpRequest")
		req.Header.Set("Referer", finalURL)

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		_ = resp.Body.Close()
		if readErr != nil {
			return nil, readErr
		}
		if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusBadRequest {
			return nil, fmt.Errorf("epay qr api returned status %d", resp.StatusCode)
		}

		var result EpayConsoleQRCode
		if err := json.Unmarshal(body, &result); err != nil {
			return nil, err
		}
		if result.Code == 100 && result.QRURL != "" {
			result.RemainingSeconds = remainingSeconds
			result.QRValue = ExtractQRCodeValue(result.QRURL)
			return &result, nil
		}
		if result.Code == 200 || result.Code == 201 {
			result.RemainingSeconds = remainingSeconds
			result.QRValue = ExtractQRCodeValue(result.QRURL)
			return &result, nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	return nil, fmt.Errorf("epay qr url not ready")
}

// ExtractQRCodeValue extracts the actual payment URL from a third-party QR
// image generator URL. Some gateways return an image URL such as
// /qrcode/get?text=<actual payment url>.
func ExtractQRCodeValue(qrURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(qrURL))
	if err != nil {
		return strings.TrimSpace(qrURL)
	}
	for _, key := range []string{"text", "data", "url", "qrcode"} {
		if value := strings.TrimSpace(parsed.Query().Get(key)); value != "" {
			return value
		}
	}
	return strings.TrimSpace(qrURL)
}

func extractEpayRemainingSeconds(html string) int {
	re := regexp.MustCompile(`var\s+intDiff\s*=\s*parseInt\(['"]?(\d+)['"]?\)`)
	match := re.FindStringSubmatch(html)
	if len(match) < 2 {
		return 0
	}
	seconds, _ := strconv.Atoi(match[1])
	return seconds
}
