package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestCalculateAudioQuotaRoundsPositiveRequestToMinimumUnit(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	quota := calculateAudioQuota(QuotaInfo{
		BillingType:  model.ModelPricingBillingRequest,
		RequestPrice: 0.1,
		GroupRatio:   1,
	})

	require.Equal(t, 1, quota)
}

func TestCalculateAudioQuotaUsesDirectMediaPricesAndGroupMultiplier(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	quota := calculateAudioQuota(QuotaInfo{
		BillingType: model.ModelPricingBillingToken,
		InputDetails: TokenDetails{
			TextTokens:  1_000_000,
			AudioTokens: 250_000,
		},
		OutputDetails: TokenDetails{
			TextTokens:  500_000,
			AudioTokens: 125_000,
		},
		InputPrice:       2,
		OutputPrice:      4,
		AudioInputPrice:  8,
		AudioOutputPrice: 16,
		GroupRatio:       1.5,
	})

	// ($2 + $2 + $2 + $2) * 1.5 group * 100 quota/USD.
	require.Equal(t, 1200, quota)
}

func TestCalculateAudioQuotaChargesCachedInputOnce(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	quota := calculateAudioQuota(QuotaInfo{
		BillingType: model.ModelPricingBillingToken,
		InputDetails: TokenDetails{
			TextTokens:        600_000,
			AudioTokens:       400_000,
			CachedTokens:      300_000,
			CachedTextTokens:  100_000,
			CachedAudioTokens: 200_000,
		},
		InputPrice:      2,
		AudioInputPrice: 8,
		CacheReadPrice:  0.5,
		GroupRatio:      1,
	})

	// 500k uncached text + 200k uncached audio + 300k cached input.
	require.Equal(t, 275, quota)
}

func TestQuotaInputTokenDetailsUsesUpstreamAggregateCacheFields(t *testing.T) {
	details := quotaInputTokenDetails(dto.InputTokenDetails{
		TextTokens:           600,
		AudioTokens:          400,
		ImageTokens:          200,
		CachedTokens:         350,
		CachedCreationTokens: 50,
	})

	require.Equal(t, 600, details.TextTokens)
	require.Equal(t, 400, details.AudioTokens)
	require.Equal(t, 200, details.ImageTokens)
	require.Equal(t, 350, details.CachedTokens)
	require.Equal(t, 50, details.CacheWriteTokens)
	require.Zero(t, details.CachedTextTokens)
	require.Zero(t, details.CachedAudioTokens)
	require.Zero(t, details.CachedImageTokens)
}

func TestCalculateAudioQuotaUsesCacheWriteAndImagePrices(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	quota := calculateAudioQuota(QuotaInfo{
		BillingType: model.ModelPricingBillingToken,
		InputDetails: TokenDetails{
			TextTokens:        400_000,
			ImageTokens:       300_000,
			CachedTokens:      200_000,
			CachedImageTokens: 200_000,
			CacheWriteTokens:  100_000,
		},
		InputPrice:      2,
		ImagePrice:      4,
		CacheReadPrice:  0.5,
		CacheWritePrice: 10,
		GroupRatio:      1,
	})

	// 300k uncached text + 100k uncached image + 200k cache read + 100k cache write.
	require.Equal(t, 210, quota)
}

func TestGenerateWssOtherInfoIncludesDirectCacheAndImagePrices(t *testing.T) {
	relayInfo := newTextQuotaRelayInfo(types.PriceData{
		BillingType:     model.ModelPricingBillingToken,
		CacheReadPrice:  0.5,
		CacheWritePrice: 10,
		ImagePrice:      4,
	})
	relayInfo.ChannelMeta = &relaycommon.ChannelMeta{}
	usage := &dto.RealtimeUsage{
		InputTokenDetails: dto.InputTokenDetails{
			CachedTokens:         300,
			CachedCreationTokens: 40,
			ImageTokens:          50,
		},
	}

	other := GenerateWssOtherInfo(
		newTextQuotaTestContext(), relayInfo, usage,
		2, 1, 4, 8, 16, 0,
	)

	require.Equal(t, model.ModelPricingBillingToken, other["billing_type"])
	require.Equal(t, 300, other["cache_tokens"])
	require.Equal(t, 0.5, other["cache_read_price"])
	require.Equal(t, 40, other["cache_write_tokens"])
	require.Equal(t, 10.0, other["cache_write_price"])
	require.Equal(t, 50, other["image_input"])
	require.Equal(t, 4.0, other["image_price"])
}
