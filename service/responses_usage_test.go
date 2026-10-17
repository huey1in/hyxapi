package service_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel/deepseek"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/require"
)

func TestResponsesUsageDeduplicatesToolsAndPreservesCacheDetails(t *testing.T) {
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "deepseek-flash"}, StreamStatus: relaycommon.NewStreamStatus()}
	(&deepseek.Adaptor{}).Init(info)
	accumulator := service.NewResponsesUsageAccumulator(info)
	search := `{"type":"web_search_call","id":"search-1","status":"completed","action":{"type":"search"}}`
	fetch := `{"type":"web_search_call","id":"fetch-1","status":"completed","action":{"type":"open_page"}}`
	observe := func(raw string) {
		var event dto.ResponsesStreamResponse
		require.NoError(t, common.UnmarshalJsonStr(raw, &event))
		accumulator.Observe(&event, []byte(raw))
	}
	observe(`{"type":"response.output_item.done","output_index":0,"item":` + search + `}`)
	observe(`{"type":"response.output_item.done","output_index":0,"item":` + search + `}`)
	observe(`{"type":"response.output_item.done","output_index":1,"item":` + fetch + `}`)
	require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[deepseek.FetchToolPriceKey].CallCount)
	observe(`{"type":"response.completed","response":{"status":"completed","output":[` + search + `,` + fetch + `],"usage":{"input_tokens":100,"output_tokens":7,"input_tokens_details":{"cached_tokens":80},"output_tokens_details":{"reasoning_tokens":4}}}}`)
	usage := accumulator.Finish()
	require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[deepseek.SearchToolPriceKey].CallCount)
	require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[deepseek.FetchToolPriceKey].CallCount)
	require.Equal(t, 100, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 80, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 4, usage.CompletionTokenDetails.ReasoningTokens)
	require.Same(t, usage, accumulator.Finish())
}

func TestResponsesUsageEstimatesInterruptedOutputButNotExplicitFailure(t *testing.T) {
	for _, failed := range []bool{false, true} {
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o"}, StreamStatus: relaycommon.NewStreamStatus()}
		info.SetEstimatePromptTokens(23)
		accumulator := service.NewResponsesUsageAccumulator(info)
		if failed {
			accumulator.Observe(&dto.ResponsesStreamResponse{Type: "response.failed"}, nil)
		} else {
			accumulator.Observe(&dto.ResponsesStreamResponse{Type: "response.function_call_arguments.delta", Delta: `{"value":"partial"}`}, nil)
		}
		usage := accumulator.Finish()
		if failed {
			require.Zero(t, usage.TotalTokens)
		} else {
			require.Equal(t, 23, usage.PromptTokens)
			require.Positive(t, usage.CompletionTokens)
		}
	}
}
