package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMergeGeminiUsageMetadataCumulativeModalities(t *testing.T) {
	first := &GeminiUsageMetadata{
		PromptTokenCount: 1100, ToolUsePromptTokenCount: 50, CandidatesTokenCount: 2,
		PromptTokensDetails:        []GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 1089}, {Modality: "TEXT", TokenCount: 11}},
		ToolUsePromptTokensDetails: []GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 50}},
		CandidatesTokensDetails:    []GeminiPromptTokensDetails{{Modality: "TEXT", TokenCount: 2}},
	}
	merged := MergeGeminiUsageMetadata(nil, first)
	merged = MergeGeminiUsageMetadata(merged, first)
	last := &GeminiUsageMetadata{
		CandidatesTokenCount:    6,
		PromptTokensDetails:     []GeminiPromptTokensDetails{{Modality: " text ", TokenCount: 7}, {Modality: "TEXT", TokenCount: 4}},
		CandidatesTokensDetails: []GeminiPromptTokensDetails{{Modality: "TEXT", TokenCount: 6}},
	}
	merged = MergeGeminiUsageMetadata(merged, last)
	require.Equal(t, 1156, merged.TotalTokenCount)
	require.Equal(t, []GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 1089}, {Modality: "TEXT", TokenCount: 7}, {Modality: "TEXT", TokenCount: 4}}, merged.PromptTokensDetails)
	require.Equal(t, first.ToolUsePromptTokensDetails, merged.ToolUsePromptTokensDetails)
	require.Equal(t, 6, merged.CandidatesTokensDetails[0].TokenCount)
	require.NotNil(t, merged.BillingUsage)
	require.Equal(t, merged.PromptTokensDetails, merged.BillingUsage.GeminiUsageMetadata.PromptTokensDetails)
	last.PromptTokensDetails[0].TokenCount = 999
	first.ToolUsePromptTokensDetails[0].TokenCount = 999
	require.Equal(t, 7, merged.PromptTokensDetails[1].TokenCount)
	require.Equal(t, 50, merged.ToolUsePromptTokensDetails[0].TokenCount)
	merged.PromptTokensDetails[0].TokenCount = 1
	require.Equal(t, 1089, merged.BillingUsage.GeminiUsageMetadata.PromptTokensDetails[0].TokenCount)
}

func TestMergeGeminiUsageMetadataExplicitModalityZero(t *testing.T) {
	previous := &GeminiUsageMetadata{PromptTokensDetails: []GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 100}}}
	merged := MergeGeminiUsageMetadata(previous, &GeminiUsageMetadata{PromptTokensDetails: []GeminiPromptTokensDetails{{Modality: "image", TokenCount: 0}}})
	require.Equal(t, []GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 0}}, merged.PromptTokensDetails)
	require.Nil(t, MergeGeminiUsageMetadata(nil, nil))
}
