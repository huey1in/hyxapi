package types

import (
	"github.com/stretchr/testify/require"
	"math"
	"testing"
)

func TestPriceDataOtherRatiosRejectInvalidValuesAndReturnCopies(t *testing.T) {
	var price PriceData
	price.AddOtherRatio("duration", 2)
	price.AddOtherRatio("resolution", 3)
	price.AddOtherRatio("negative", -1)
	price.AddOtherRatio("nan", math.NaN())
	price.AddOtherRatio("infinite", math.Inf(1))
	ratios := price.OtherRatios()
	require.Len(t, ratios, 2)
	ratios["duration"] = 999
	require.Equal(t, 30.0, price.ApplyOtherRatiosToFloat(5))
	require.Equal(t, 5.0, price.RemoveOtherRatiosFromFloat(30))
	require.True(t, price.ReplaceOtherRatios(map[string]float64{"duration": 4}))
	require.False(t, price.HasOtherRatio("resolution"))
	require.Equal(t, 4.0, price.OtherRatioMultiplier())
	require.False(t, price.ReplaceOtherRatios(nil))
	require.Equal(t, 1.0, price.OtherRatioMultiplier())
}
