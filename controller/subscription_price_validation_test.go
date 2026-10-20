package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionPriceRejectsValuesThatWouldRoundToFreeInMySQL(t *testing.T) {
	for _, price := range []float64{0, 1, 9999, 0.000001, 1.234567} {
		require.NoError(t, validateSubscriptionPurchaseFields(&model.SubscriptionPlan{PriceAmount: price}))
	}
	for _, price := range []float64{0.0000001, 0.00000001, 1.2345678, -1, 10000, math.NaN(), math.Inf(1)} {
		require.Error(t, validateSubscriptionPurchaseFields(&model.SubscriptionPlan{PriceAmount: price}))
	}
}
