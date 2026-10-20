package service

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestTextToolSurchargesUseResolvedModelPricesAndIncludeCompletedImages(t *testing.T) {
	operation_setting.SetToolPriceForTest("file_search:resolved-model*", 8)
	operation_setting.SetToolPriceForTest("custom_priced:resolved-model*", 4)
	t.Cleanup(func() {
		operation_setting.DeleteToolPriceForTest("file_search:resolved-model*")
		operation_setting.DeleteToolPriceForTest("custom_priced:resolved-model*")
	})
	price := types.PriceData{GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1.5}}
	info := newTextQuotaRelayInfo(price)
	info.PricingModelName, info.RelayMode = "resolved-model-v1", relayconstant.RelayModeResponses
	info.ResponsesUsageInfo = &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
		"file_search": {CallCount: 2}, "custom_priced": {CallCount: 3}, "image_generation": {CallCount: 2},
	}}
	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), info, &dto.Usage{})
	want := (8.0*2 + 4.0*3 + 150.0*2) / 1000 * 1.5 * common.QuotaPerUnit
	require.Equal(t, int(want), summary.Quota)
	require.Len(t, summary.ToolSurchargeItems, 3)
	require.Equal(t, []ToolSurchargeItem{{Name: "custom_priced", Count: 3, Price: 4}, {Name: "file_search", Count: 2, Price: 8}, {Name: "image_generation", Count: 2, Price: 150}}, summary.ToolSurchargeItems)
	require.Equal(t, 8.0, summary.FileSearchPrice)
	require.True(t, summary.hasBillableUsage())
	// Expression settlement adds precisely the same tool quota once.
	info.TieredBillingSnapshot = makeSnapshot(`tier("flat", p * 2)`, 1.5, 10, 0)
	withExpression := calculateTextQuotaSummary(newTextQuotaTestContext(), info, &dto.Usage{PromptTokens: 10})
	require.Equal(t, summary.Quota+15, withExpression.Quota)
}

func TestTextToolSurchargesCapVendorCountsAndHonorExplicitZero(t *testing.T) {
	operation_setting.SetToolPriceForTest("custom_cap", 2)
	operation_setting.SetToolPriceForTest("image_generation:free-tools*", 0)
	t.Cleanup(func() {
		operation_setting.DeleteToolPriceForTest("custom_cap")
		operation_setting.DeleteToolPriceForTest("image_generation:free-tools*")
	})
	info := newTextQuotaRelayInfo(types.PriceData{GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1}})
	info.PricingModelName, info.RelayMode = "free-tools-model", relayconstant.RelayModeResponses
	info.ResponsesUsageInfo = &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
		"custom_cap": {CallCount: math.MaxInt}, "image_generation": {CallCount: 2}, "file_search": {CallCount: -3},
	}}
	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), info, &dto.Usage{})
	require.Equal(t, int(2.0*relaycommon.MaxBillableToolCallCount/1000*common.QuotaPerUnit), summary.Quota)
	require.Equal(t, []ToolSurchargeItem{{Name: "custom_cap", Count: relaycommon.MaxBillableToolCallCount, Price: 2}}, summary.ToolSurchargeItems)
	// Vendor zero overrides an earlier inferred or protocol count.
	info.SetBillableToolCount("custom_cap", 0)
	zero := calculateTextQuotaSummary(newTextQuotaTestContext(), info, &dto.Usage{})
	require.Zero(t, zero.Quota)
	require.Empty(t, zero.ToolSurchargeItems)
}
