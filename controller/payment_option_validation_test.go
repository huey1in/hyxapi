package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaymentConfigurationRejectsInvalidMonetaryValues(t *testing.T) {
	for _, fixture := range []struct{ key, value string }{
		{"StripeUnitPrice", "NaN"}, {"WaffoUnitPrice", "Inf"}, {"Price", "0"},
		{"MinTopUp", "0"}, {"StripeMinTopUp", "1.5"},
		{"payment_setting.amount_options", `[1,-2]`}, {"payment_setting.amount_options", `[1.5]`},
		{"payment_setting.amount_discount", `{"20":0}`}, {"payment_setting.amount_discount", `{"not-a-quantity":0.9}`},
		{"TopupGroupRatio", `{"default":-1}`},
		{"CreemProducts", `[{"productId":"p","price":1,"quota":-1,"currency":"USD"}]`},
		{"CreemProducts", `[{"productId":"p","price":1,"quota":1,"currency":"USD"},{"productId":"p","price":2,"quota":2,"currency":"USD"}]`},
		{"WaffoPayMethods", `[{"name":"Card"}]`},
	} {
		t.Run(fixture.key+"/"+fixture.value, func(t *testing.T) { require.Error(t, validatePaymentOption(fixture.key, fixture.value)) })
	}
	for _, fixture := range []struct{ key, value string }{
		{"StripeUnitPrice", "2.5"}, {"MinTopUp", "1"}, {"payment_setting.amount_options", `[1,20,100]`},
		{"payment_setting.amount_discount", `{"20":0.9}`}, {"TopupGroupRatio", `{"default":1}`},
		{"CreemProducts", `[{"productId":"p","price":2,"quota":1250000,"currency":"USD"}]`},
		{"WaffoPayMethods", `[{"name":"Card","payMethodType":"CREDITCARD"}]`},
	} {
		require.NoError(t, validatePaymentOption(fixture.key, fixture.value))
	}
}
