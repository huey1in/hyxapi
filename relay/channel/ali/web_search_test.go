package ali

import (
	"encoding/json"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

func TestNativeAnthropicSearchPreservesSystemAndAddsEntrypointOnce(t *testing.T) {
	for _, system := range []any{nil, "original instruction", []any{map[string]any{"type": "text", "text": "original instruction", "cache_control": map[string]any{"type": "ephemeral"}}}} {
		info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "qwen-plus"}}
		adaptor := &Adaptor{}
		adaptor.Init(info)
		require.Equal(t, "search_strategy_agent", info.WebSearchBillingKey)
		request := &dto.ClaudeRequest{Model: "qwen-plus", System: system, Tools: []any{&dto.ClaudeWebSearchTool{Type: "web_search_20250305", Name: "web_search"}}}
		_, err := adaptor.ConvertClaudeRequest(nil, info, request)
		require.NoError(t, err)
		first, err := json.Marshal(request.System)
		require.NoError(t, err)
		require.Contains(t, string(first), "cc_entrypoint=cli")
		if system != nil {
			require.Contains(t, string(first), "original instruction")
		}
		_, err = adaptor.ConvertClaudeRequest(nil, info, request)
		require.NoError(t, err)
		second, err := json.Marshal(request.System)
		require.NoError(t, err)
		require.JSONEq(t, string(first), string(second))
		if _, blocks := system.([]any); blocks {
			require.Contains(t, string(second), "cache_control")
		}
	}
	request := &dto.ClaudeRequest{System: "original instruction"}
	ensureAnthropicWebSearchEntrypoint(request)
	require.Equal(t, "original instruction", request.System)
}

func TestResponsesUsesCompatibleModeEndpoint(t *testing.T) {
	url, err := (&Adaptor{}).GetRequestURL(&relaycommon.RelayInfo{RelayMode: constant.RelayModeResponses, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://dashscope.example"}})
	require.NoError(t, err)
	require.Equal(t, "https://dashscope.example/compatible-mode/v1/responses", url)
}
