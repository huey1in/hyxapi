package controller

import (
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

func validatePaymentOption(key, value string) error {
	if value == "" && (key == "CreemProducts" || key == "WaffoPayMethods") {
		return nil
	}
	switch key {
	case "Price", "StripeUnitPrice", "WaffoUnitPrice", "WaffoPancakeUnitPrice":
		number, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(number) || math.IsInf(number, 0) || number <= 0 {
			return errors.New("payment unit price must be finite and greater than zero")
		}
	case "MinTopUp", "StripeMinTopUp", "WaffoMinTopUp", "WaffoPancakeMinTopUp":
		number, err := strconv.ParseInt(value, 10, 64)
		if err != nil || number < 1 || number > common.MaxWalletQuota {
			return errors.New("minimum top-up must be a positive integer within the wallet quota limit")
		}
	case "payment_setting.amount_options":
		var values []int64
		if err := json.Unmarshal([]byte(value), &values); err != nil || len(values) > 30 {
			return errors.New("top-up presets must be an array of at most 30 integers")
		}
		for _, number := range values {
			if number <= 0 || number > common.MaxWalletQuota {
				return errors.New("top-up presets must be positive integers within the wallet quota limit")
			}
		}
	case "payment_setting.amount_discount", "TopupGroupRatio":
		var values map[string]float64
		if err := json.Unmarshal([]byte(value), &values); err != nil || values == nil {
			return errors.New("payment ratios must be a JSON object")
		}
		for name, ratio := range values {
			if strings.TrimSpace(name) == "" || math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 {
				return errors.New("payment ratios must be finite and greater than zero")
			}
			if key == "payment_setting.amount_discount" {
				amount, err := strconv.ParseInt(name, 10, 64)
				if err != nil || amount <= 0 {
					return errors.New("discount keys must be positive top-up quantities")
				}
			}
		}
	case "CreemProducts":
		var products []CreemProduct
		if err := json.Unmarshal([]byte(value), &products); err != nil {
			return errors.New("Creem products must be a JSON array")
		}
		seen := map[string]bool{}
		for _, product := range products {
			if strings.TrimSpace(product.ProductId) == "" || seen[product.ProductId] || product.Price <= 0 || product.Quota <= 0 || product.Quota > common.MaxWalletQuota || len(product.Currency) != 3 {
				return errors.New("Creem products require unique IDs, positive prices and quota, and a three-letter currency")
			}
			seen[product.ProductId] = true
		}
	case "WaffoPayMethods":
		var methods []constant.WaffoPayMethod
		if err := json.Unmarshal([]byte(value), &methods); err != nil {
			return errors.New("Waffo payment methods must be a JSON array")
		}
		for _, method := range methods {
			if strings.TrimSpace(method.Name) == "" || strings.TrimSpace(method.PayMethodType) == "" {
				return errors.New("Waffo payment methods require name and payMethodType")
			}
		}
	}
	return nil
}
