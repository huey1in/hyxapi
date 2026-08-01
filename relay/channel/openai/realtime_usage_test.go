package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestAccumulateRealtimeUsageIncludesEveryTokenClass(t *testing.T) {
	dst := &dto.RealtimeUsage{
		TotalTokens:  10,
		InputTokens:  6,
		OutputTokens: 4,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens:           3,
			AudioTokens:          2,
			ImageTokens:          1,
			CachedTokens:         2,
			CachedCreationTokens: 1,
			CachedTokensDetails: &dto.CachedTokenDetails{
				TextTokens:  1,
				AudioTokens: 1,
				ImageTokens: 0,
			},
		},
		OutputTokenDetails: dto.OutputTokenDetails{
			TextTokens:      2,
			AudioTokens:     1,
			ReasoningTokens: 1,
		},
	}
	src := &dto.RealtimeUsage{
		TotalTokens:  100,
		InputTokens:  70,
		OutputTokens: 30,
		InputTokenDetails: dto.InputTokenDetails{
			TextTokens:           30,
			AudioTokens:          20,
			ImageTokens:          20,
			CachedTokens:         15,
			CachedCreationTokens: 9,
			CachedTokensDetails: &dto.CachedTokenDetails{
				TextTokens:  7,
				AudioTokens: 5,
				ImageTokens: 3,
			},
		},
		OutputTokenDetails: dto.OutputTokenDetails{
			TextTokens:      20,
			AudioTokens:     8,
			ReasoningTokens: 2,
		},
	}

	accumulateRealtimeUsage(dst, src)

	require.Equal(t, 110, dst.TotalTokens)
	require.Equal(t, 76, dst.InputTokens)
	require.Equal(t, 34, dst.OutputTokens)
	require.Equal(t, 33, dst.InputTokenDetails.TextTokens)
	require.Equal(t, 22, dst.InputTokenDetails.AudioTokens)
	require.Equal(t, 21, dst.InputTokenDetails.ImageTokens)
	require.Equal(t, 17, dst.InputTokenDetails.CachedTokens)
	require.Equal(t, 10, dst.InputTokenDetails.CachedCreationTokens)
	require.Equal(t, &dto.CachedTokenDetails{
		TextTokens:  8,
		AudioTokens: 6,
		ImageTokens: 3,
	}, dst.InputTokenDetails.CachedTokensDetails)
	require.Equal(t, 22, dst.OutputTokenDetails.TextTokens)
	require.Equal(t, 9, dst.OutputTokenDetails.AudioTokens)
	require.Equal(t, 3, dst.OutputTokenDetails.ReasoningTokens)
}

func TestAccumulateRealtimeUsageCopiesCachedDetails(t *testing.T) {
	src := &dto.RealtimeUsage{
		InputTokenDetails: dto.InputTokenDetails{
			CachedTokensDetails: &dto.CachedTokenDetails{TextTokens: 5},
		},
	}
	dst := &dto.RealtimeUsage{}

	accumulateRealtimeUsage(dst, src)
	dst.InputTokenDetails.CachedTokensDetails.TextTokens++

	require.Equal(t, 5, src.InputTokenDetails.CachedTokensDetails.TextTokens)
}
