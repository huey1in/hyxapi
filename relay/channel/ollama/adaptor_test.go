package ollama

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOllamaNativeRequestPreservesToolIdentityAndExplicitNonStream(t *testing.T) {
	var request dto.GeneralOpenAIRequest
	require.NoError(t, common.UnmarshalJsonStr(`{"model":"llama-test","stream":false,"reasoning_effort":"none","response_format":{"type":"json_schema","json_schema":{"name":"result","schema":{"type":"object","properties":{"ok":{"type":"boolean"}}}}},"messages":[{"role":"assistant","content":"","tool_calls":[{"id":"provider-call","type":"function","function":{"name":"lookup","arguments":"{}"}}]},{"role":"tool","tool_call_id":"provider-call","content":"result"}]}`, &request))
	converted, err := openAIChatToOllamaChat(nil, &request)
	require.NoError(t, err)
	raw, err := json.Marshal(converted)
	require.NoError(t, err)
	require.True(t, gjson.GetBytes(raw, "stream").Exists(), "Ollama defaults to streaming when stream is omitted")
	require.False(t, gjson.GetBytes(raw, "stream").Bool())
	require.Equal(t, "provider-call", converted.Messages[0].ToolCalls[0].ID)
	require.Equal(t, "provider-call", converted.Messages[1].ToolCallID)
	require.Equal(t, "lookup", converted.Messages[1].ToolName)
	require.JSONEq(t, `false`, string(converted.Think))
	require.Equal(t, "object", gjson.GetBytes(raw, "format.type").String())
	require.False(t, gjson.GetBytes(raw, "format.schema").Exists())
}

func TestOllamaProtocolRoutesAndOpenAIChatOptIn(t *testing.T) {
	for _, tc := range []struct {
		format types.RelayFormat
		mode   int
		compat bool
		path   string
	}{
		{types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions, false, "/api/chat"},
		{types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions, true, "/v1/chat/completions"},
		{types.RelayFormatOpenAI, relayconstant.RelayModeCompletions, true, "/api/generate"},
		{types.RelayFormatClaude, relayconstant.RelayModeChatCompletions, false, "/v1/messages"},
		{types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses, false, "/v1/responses"},
		{types.RelayFormatOpenAIResponsesCompaction, relayconstant.RelayModeResponsesCompact, false, "/v1/responses/compact"},
	} {
		info := &relaycommon.RelayInfo{RelayFormat: tc.format, RelayMode: tc.mode, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ollama.example", ChannelOtherSettings: dto.ChannelOtherSettings{OllamaOpenAIChat: tc.compat}}}
		url, err := (&Adaptor{}).GetRequestURL(info)
		require.NoError(t, err)
		require.Equal(t, "https://ollama.example"+tc.path, url)
	}
}

func TestOllamaDoneFrameDeliversItsLastTextAndProviderCallID(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "llama-test"}}
	response := &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(`{"model":"llama-test","message":{"role":"assistant","content":"last text","tool_calls":[{"id":"provider-call","function":{"name":"lookup","arguments":{"q":"x"}}}]},"done":true,"done_reason":"stop","prompt_eval_count":5,"eval_count":7}`))}
	usage, err := ollamaStreamHandler(c, info, response)
	require.Nil(t, err)
	require.Equal(t, 12, usage.TotalTokens)
	require.Contains(t, w.Body.String(), "last text")
	require.Contains(t, w.Body.String(), "provider-call")
	require.Contains(t, w.Body.String(), "[DONE]")
}
