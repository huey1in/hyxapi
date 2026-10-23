package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/setting/system_setting"
)

// Epusdt v2 signs all nonempty scalar fields, sorted by ASCII key.
func EpusdtSignature(fields map[string]any, secret string) (string, error) {
	keys := make([]string, 0, len(fields))
	values := map[string]string{}
	for key, value := range fields {
		if key == "signature" || value == nil {
			continue
		}
		var text string
		switch v := value.(type) {
		case string:
			text = v
		case json.Number:
			// Epusdt converts JSON numbers to float64 before canonicalization.
			number, err := v.Float64()
			if err != nil {
				return "", err
			}
			text = strconv.FormatFloat(number, 'f', -1, 64)
		case int:
			text = fmt.Sprint(v)
		case int64:
			text = fmt.Sprint(v)
		default:
			return "", errors.New("Invalid Epusdt signature field")
		}
		if text != "" {
			keys = append(keys, key)
			values[key] = text
		}
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, key := range keys {
		pairs = append(pairs, key+"="+values[key])
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strings.Join(pairs, "&")))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

func VerifyEpusdtSignature(fields map[string]any, secret string) bool {
	provided, ok := fields["signature"].(string)
	if !ok || secret == "" {
		return false
	}
	expected, err := EpusdtSignature(fields, secret)
	if err != nil {
		return false
	}
	decoded, err := hex.DecodeString(provided)
	if err != nil {
		return false
	}
	wanted, _ := hex.DecodeString(expected)
	return hmac.Equal(decoded, wanted)
}

type EpusdtPayment struct {
	TradeID        string      `json:"trade_id"`
	OrderID        string      `json:"order_id"`
	Amount         json.Number `json:"amount"`
	Currency       string      `json:"currency"`
	ActualAmount   json.Number `json:"actual_amount"`
	ReceiveAddress string      `json:"receive_address"`
	Token          string      `json:"token"`
	Network        string      `json:"network"`
	Status         int         `json:"status"`
	ExpirationTime int64       `json:"expiration_time"`
}

// Never follow redirects: the merchant key may only be sent to the configured gateway.
var epusdtHTTP = &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

func epusdtRequest(ctx context.Context, base, method, path string, fields map[string]any) (*EpusdtPayment, error) {
	var body io.Reader
	if fields != nil {
		data, err := json.Marshal(fields)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(base, "/")+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := epusdtHTTP.Do(req)
	if err != nil {
		return nil, errors.New("USDT gateway is unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, errors.New("USDT gateway rejected the request")
	}
	var envelope struct {
		Code int           `json:"status_code"`
		Data EpusdtPayment `json:"data"`
	}
	decoder := json.NewDecoder(io.LimitReader(res.Body, 65536))
	decoder.UseNumber()
	if decoder.Decode(&envelope) != nil || envelope.Code != 200 {
		return nil, errors.New("Invalid USDT gateway response")
	}
	return &envelope.Data, nil
}

func CreateEpusdtPayment(ctx context.Context, s system_setting.USDTSettings, orderID string, amount int64, callback, redirect string) (*EpusdtPayment, error) {
	fields := map[string]any{"pid": s.MerchantID, "order_id": orderID, "currency": "usd", "token": "usdt", "network": s.Network, "amount": amount, "notify_url": callback, "redirect_url": redirect, "name": "HyxAPI credits"}
	signature, err := EpusdtSignature(fields, s.APIKey)
	if err != nil {
		return nil, err
	}
	fields["signature"] = signature
	return epusdtRequest(ctx, s.GatewayURL, http.MethodPost, "/payments/gmpay/v1/order/create-transaction", fields)
}

func GetEpusdtPayment(ctx context.Context, base, tradeID string) (*EpusdtPayment, error) {
	return epusdtRequest(ctx, base, http.MethodGet, "/pay/checkout-counter-resp/"+url.PathEscape(tradeID), nil)
}
