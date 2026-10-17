package relayconvert

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

func TestGeminiConvertedStreamRetainsOmittedUsageModalities(t *testing.T) {
	state, err := NewResponseStreamState(types.RelayFormatGemini, types.RelayFormatOpenAI, ResponseStreamOptions{})
	require.NoError(t, err)
	info := &convmeta.Values{ChannelMetaAttached: true, UpstreamModelName: "gemini-3-flash-preview"}
	initial := &dto.GeminiChatResponse{HasUsageMetadata: true, UsageMetadata: dto.GeminiUsageMetadata{
		PromptTokenCount: 1100, CandidatesTokenCount: 2,
		PromptTokensDetails:     []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 1089}, {Modality: "TEXT", TokenCount: 11}},
		CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{{Modality: "TEXT", TokenCount: 2}},
	}}
	for _, frame := range []*dto.GeminiChatResponse{initial, initial, {HasUsageMetadata: true, UsageMetadata: dto.GeminiUsageMetadata{
		CandidatesTokenCount: 7, CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{{Modality: "TEXT", TokenCount: 7}},
	}}, {}} {
		results, err := ConvertStreamResponseChunk(nil, info, state, frame)
		require.NoError(t, err)
		for _, result := range results {
			if result.Usage != nil {
				require.Equal(t, 1089, result.Usage.PromptTokensDetails.ImageTokens)
			}
		}
	}
	results, err := FinalizeStreamResponse(nil, info, state)
	require.NoError(t, err)
	require.NotEmpty(t, results)
	usage := results[len(results)-1].Usage
	require.NotNil(t, usage)
	require.Equal(t, 1100, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 1089, usage.PromptTokensDetails.ImageTokens)
	require.Equal(t, 11, usage.PromptTokensDetails.TextTokens)
	require.Equal(t, 7, usage.CompletionTokenDetails.TextTokens)
	require.Equal(t, 1089, usage.BillingUsage.GeminiUsageMetadata.PromptTokensDetails[0].TokenCount)
}
