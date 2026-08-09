package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newTextQuotaTestContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	return ctx
}

func newTextQuotaRelayInfo(priceData types.PriceData) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "priced-model",
		PriceData:       priceData,
		StartTime:       time.Now(),
	}
}

func tokenPriceData() types.PriceData {
	return types.PriceData{
		BillingType:     model.ModelPricingBillingToken,
		InputPrice:      2,
		OutputPrice:     4,
		CacheReadPrice:  1,
		CacheWritePrice: 10,
		GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 1},
	}
}

func TestCalculateTextQuotaSummaryAnthropicChargesInputAndCacheClassesIndependently(t *testing.T) {
	priceData := tokenPriceData()
	priceData.GroupRatioInfo.GroupRatio = 1.5
	relayInfo := newTextQuotaRelayInfo(priceData)
	relayInfo.FinalRequestRelayFormat = types.RelayFormatClaude
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
		ClaudeCacheCreation5mTokens: 10,
		ClaudeCacheCreation1hTokens: 20,
	}

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, usage)

	// Anthropic input_tokens excludes cache classes: all 1,000 input tokens
	// remain billable, while cache reads and the normalized 50 writes are added.
	require.Equal(t, 2550, summary.Quota)
	require.Equal(t, 1000, summary.PromptTokens)
	require.Equal(t, 50, summary.CacheCreationTokens)
	require.True(t, summary.IsClaudeUsageSemantic)
}

func TestCalculateTextQuotaSummaryUsesExplicitAnthropicUsageSemantic(t *testing.T) {
	relayInfo := newTextQuotaRelayInfo(tokenPriceData())
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		UsageSemantic:    "anthropic",
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
	}

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, usage)

	require.True(t, summary.IsClaudeUsageSemantic)
	require.Equal(t, "anthropic", summary.UsageSemantic)
	require.Equal(t, 1700, summary.Quota)
}

func TestCalculateTextQuotaSummaryOpenAISubtractsCacheClassesOnce(t *testing.T) {
	relayInfo := newTextQuotaRelayInfo(tokenPriceData())
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 200,
		UsageSemantic:    "openai",
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
	}

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, usage)

	// Base input is 850 tokens. Cache read and write tokens are then charged
	// exactly once using their own direct prices.
	require.Equal(t, 1550, summary.Quota)
	require.Equal(t, 1000, summary.PromptTokens)
}

func TestCalculateTextQuotaSummaryNormalizesAggregateAndSplitCacheWrites(t *testing.T) {
	relayInfo := newTextQuotaRelayInfo(tokenPriceData())
	usage := &dto.Usage{
		PromptTokens:  100,
		UsageSemantic: "openai",
		PromptTokensDetails: dto.InputTokenDetails{
			CachedCreationTokens: 70,
		},
		ClaudeCacheCreation5mTokens: 20,
		ClaudeCacheCreation1hTokens: 30,
	}

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, usage)

	require.Equal(t, 70, summary.CacheCreationTokens)
	require.Equal(t, 380, summary.Quota)
}

func TestCalculateTextQuotaSummaryChargesSplitOnlyCacheWrites(t *testing.T) {
	relayInfo := newTextQuotaRelayInfo(tokenPriceData())
	usage := &dto.Usage{
		PromptTokens:                100,
		UsageSemantic:               "openai",
		ClaudeCacheCreation5mTokens: 20,
		ClaudeCacheCreation1hTokens: 30,
	}

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, usage)

	require.Equal(t, 50, summary.CacheCreationTokens)
	require.Equal(t, 300, summary.Quota)
}

func TestCalculateTextQuotaSummaryDoesNotCreateNegativeTextOutputCharge(t *testing.T) {
	priceData := tokenPriceData()
	priceData.AudioOutputPrice = 10
	relayInfo := newTextQuotaRelayInfo(priceData)
	usage := &dto.Usage{
		CompletionTokens: 20,
		CompletionTokenDetails: dto.OutputTokenDetails{
			AudioTokens: 30,
		},
	}

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, usage)

	require.Equal(t, 150, summary.Quota)
}

func TestCalculateTextQuotaSummaryChargesRequestPriceWithZeroTokens(t *testing.T) {
	priceData := types.PriceData{
		BillingType:    model.ModelPricingBillingRequest,
		RequestPrice:   0.02,
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1.5},
	}
	relayInfo := newTextQuotaRelayInfo(priceData)

	summary := calculateTextQuotaSummary(newTextQuotaTestContext(), relayInfo, &dto.Usage{})

	require.Equal(t, 15000, summary.Quota)
	require.True(t, summary.hasBillableUsage())
}

func TestCalculateTextQuotaSummaryDoesNotChargeZeroRatioGroup(t *testing.T) {
	tests := []struct {
		name      string
		priceData types.PriceData
		usage     *dto.Usage
	}{
		{
			name: "token billing",
			priceData: types.PriceData{
				BillingType:    model.ModelPricingBillingToken,
				InputPrice:     2,
				OutputPrice:    4,
				GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0},
			},
			usage: &dto.Usage{PromptTokens: 1000, CompletionTokens: 200},
		},
		{
			name: "request billing",
			priceData: types.PriceData{
				BillingType:    model.ModelPricingBillingRequest,
				RequestPrice:   0.02,
				GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 0},
			},
			usage: &dto.Usage{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary := calculateTextQuotaSummary(
				newTextQuotaTestContext(),
				newTextQuotaRelayInfo(tt.priceData),
				tt.usage,
			)

			require.Zero(t, summary.Quota)
		})
	}
}

func TestCacheWriteTokensTotal(t *testing.T) {
	tests := []struct {
		name    string
		summary textQuotaSummary
		want    int
	}{
		{
			name: "aggregate larger than split",
			summary: textQuotaSummary{
				CacheCreationTokens:   50,
				CacheCreationTokens5m: 10,
				CacheCreationTokens1h: 20,
			},
			want: 50,
		},
		{
			name:    "aggregate only",
			summary: textQuotaSummary{CacheCreationTokens: 50},
			want:    50,
		},
		{
			name: "split only",
			summary: textQuotaSummary{
				CacheCreationTokens5m: 10,
				CacheCreationTokens1h: 20,
			},
			want: 30,
		},
		{
			name: "split larger than aggregate",
			summary: textQuotaSummary{
				CacheCreationTokens:   10,
				CacheCreationTokens5m: 10,
				CacheCreationTokens1h: 20,
			},
			want: 30,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, cacheWriteTokensTotal(tt.summary))
		})
	}
}
