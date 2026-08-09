package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestCalculateChannelTestQuotaKeepsPositiveRequestCharge(t *testing.T) {
	priceData := &types.PriceData{
		BillingType:  model.ModelPricingBillingRequest,
		RequestPrice: 0.0000001,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}

	quota, cacheWriteTokens := calculateChannelTestQuota(nil, priceData, false)

	require.Equal(t, 1, quota)
	require.Zero(t, cacheWriteTokens)
}

func TestCalculateChannelTestQuotaNormalizesCacheWrites(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens: 120,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 100,
		},
		ClaudeCacheCreation5mTokens: 60,
		ClaudeCacheCreation1hTokens: 60,
	}
	priceData := &types.PriceData{
		BillingType:     model.ModelPricingBillingToken,
		InputPrice:      100,
		CacheWritePrice: 2,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}

	quota, cacheWriteTokens := calculateChannelTestQuota(usage, priceData, false)

	require.Equal(t, 120, cacheWriteTokens)
	require.Equal(t, 120, quota)
}

func TestCalculateChannelTestQuotaKeepsAnthropicPromptIndependentFromCache(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens: 100,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         40,
			CachedCreationTokens: 20,
		},
	}
	priceData := &types.PriceData{
		BillingType: model.ModelPricingBillingToken,
		InputPrice:  10,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}

	anthropicQuota, _ := calculateChannelTestQuota(usage, priceData, true)
	openAIQuota, _ := calculateChannelTestQuota(usage, priceData, false)

	require.Equal(t, 500, anthropicQuota)
	require.Equal(t, 200, openAIQuota)
}

func TestCalculateChannelTestQuotaChargesDedicatedTokenClasses(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 50,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 100,
			ImageTokens:          200,
			AudioTokens:          100,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: 20,
		},
	}
	priceData := &types.PriceData{
		BillingType:      model.ModelPricingBillingToken,
		InputPrice:       1,
		OutputPrice:      7,
		CacheReadPrice:   2,
		CacheWritePrice:  3,
		ImagePrice:       4,
		AudioInputPrice:  5,
		AudioOutputPrice: 6,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}

	quota, _ := calculateChannelTestQuota(usage, priceData, false)

	require.Equal(t, 1315, quota)
}

func TestCalculateChannelTestQuotaClampsNegativeTextOutput(t *testing.T) {
	usage := &dto.Usage{
		CompletionTokens: 20,
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: 50,
		},
	}
	priceData := &types.PriceData{
		BillingType:      model.ModelPricingBillingToken,
		OutputPrice:      100,
		AudioOutputPrice: 2,
		GroupRatioInfo: types.GroupRatioInfo{
			GroupRatio: 1,
		},
	}

	quota, _ := calculateChannelTestQuota(usage, priceData, false)

	require.Equal(t, 50, quota)
}
