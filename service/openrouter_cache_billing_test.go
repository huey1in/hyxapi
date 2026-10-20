package service

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestTextQuotaChargesNativeCacheWritesOnce(t *testing.T) {
	for _, legacy := range []int{0, 50, 100} {
		usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 200,
			PromptTokensDetails: dto.InputTokenDetails{CachedTokens: 100, CacheWriteTokens: 100, CachedCreationTokens: legacy}}
		usage.BillingUsage = dto.NewOpenAIChatBillingUsage(usage)
		summary := calculateTextQuotaSummary(newTextQuotaTestContext(), newTextQuotaRelayInfo(tokenPriceData()), effectiveBillingUsage(usage))
		require.Equal(t, 100, summary.CacheCreationTokens)
		require.Equal(t, 1750, summary.Quota)
	}
}

func TestTextQuotaOpenRouterInfersDefaultTariffWrites(t *testing.T) {
	price := tokenPriceData()
	price.BillingMode, price.ModelRatio = "ratio", 1.5
	price.CompletionRatio, price.CacheRatio, price.CacheCreationRatio = 5, 0.1, 1.25
	price.InputPrice, price.OutputPrice, price.CacheReadPrice, price.CacheWritePrice = 3, 15, 0.3, 3.75
	price.CacheWrite5mPrice, price.CacheWrite1hPrice = 3.75, 6
	info := newTextQuotaRelayInfo(price)
	info.OriginModelName = "claude-3-5-sonnet-20241022"
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenRouter}
	usage := &dto.Usage{PromptTokens: 1000, CompletionTokens: 20, UsageSemantic: "anthropic", Cost: float64(0.00318),
		PromptTokensDetails: dto.InputTokenDetails{CachedTokens: 100}}
	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), info, usage)
	require.Equal(t, 200, summary.CacheCreationTokens)
	require.Equal(t, 700, summary.PromptTokens)
	require.Equal(t, 1590, summary.Quota)
	require.Equal(t, 1000, usage.PromptTokens, "do not mutate protocol/logging snapshots")
	require.Zero(t, usage.PromptTokensDetails.CachedCreationTokens)

	info.PriceData.ModelRatio = 2 // A custom tariff must never infer usage from provider cost.
	summary = calculateTextQuotaSummary(newTextQuotaTestContext(), info, usage)
	require.Zero(t, summary.CacheCreationTokens)
	info.PriceData.BillingMode = "direct"
	summary = calculateTextQuotaSummary(newTextQuotaTestContext(), info, usage)
	require.Zero(t, summary.CacheCreationTokens)
	require.Equal(t, 1000, summary.PromptTokens)
	info.PriceData = price
	usage.PromptTokensDetails.CachedCreationTokens = 50
	summary = calculateTextQuotaSummary(newTextQuotaTestContext(), info, usage)
	require.Equal(t, 50, summary.CacheCreationTokens, "reported writes take precedence over inference")
}

func TestOpenRouterCacheInferenceRejectsInvalidCostAndUnboundedCounts(t *testing.T) {
	price := tokenPriceData()
	price.ModelRatio, price.CompletionRatio, price.CacheRatio, price.CacheCreationRatio = 1.5, 5, 0.1, 1.25
	for _, cost := range []any{nil, "0.00318", float64(0), float64(-1), math.NaN(), math.Inf(1), math.MaxFloat64} {
		require.Equal(t, -1, CalcOpenRouterCacheCreateTokens(dto.Usage{PromptTokens: 1000, Cost: cost}, price))
	}
	price.CacheCreationRatio = 1
	require.Zero(t, CalcOpenRouterCacheCreateTokens(dto.Usage{}, price))
}
