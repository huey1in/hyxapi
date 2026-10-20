package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCollectStreamFunctionCallNamesDedupesSameIndex(t *testing.T) {
	seen := make(map[string]struct{})
	var names []string

	chunks := []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"c2","type":"function","function":{"name":"get_time","arguments":""}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{}"}}]}}]}`,
	}
	for _, chunk := range chunks {
		observeStreamChoices(&relaycommon.RelayInfo{}, chunk, seen, &names)
	}

	require.Len(t, names, 2)
	assert.Equal(t, []string{"get_weather", "get_time"}, names)
}

func TestStreamFunctionIdentityHandlesReusedIndexesAndDelayedIDs(t *testing.T) {
	info := &relaycommon.RelayInfo{StreamStatus: relaycommon.NewStreamStatus()}
	seen := make(map[string]struct{})
	var names []string
	for _, chunk := range []string{
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":" lookup "}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"first","function":{"name":"lookup"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"first","function":{"name":"lookup"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"second","function":{"name":"lookup"}}]}}]}`,
		`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"lookup"}}]}}]}`,
		`{"choices":[{"index":1,"delta":{"tool_calls":[{"index":0,"id":"first","function":{"name":"lookup"}}]}}]}`,
	} {
		observeStreamChoices(info, chunk, seen, &names)
	}
	require.Equal(t, []string{"lookup", "lookup", "lookup"}, names)
}

func TestChatStreamUsesLatestCompleteUsageSnapshot(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	for _, tc := range []struct {
		name, last           string
		input, output, cache int
	}{
		{"empty terminal", `{"choices":[]}`, 101, 7, 60},
		{"latest valid snapshot wins", `{"usage":{"prompt_tokens":103,"completion_tokens":9,"total_tokens":112},"choices":[]}`, 103, 9, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI, RelayMode: relayconstant.RelayModeChatCompletions, ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeZhipu_v4, UpstreamModelName: "glm-text"}, StreamStatus: relaycommon.NewStreamStatus()}
			previous := `{"model":"glm-text","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":101,"completion_tokens":7,"total_tokens":108,"cached_tokens":60}}`
			stream := fmt.Sprintf("data: %s\n\ndata: %s\n\ndata: [DONE]\n\n", previous, tc.last)
			usage, err := OaiStreamHandler(c, info, &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(stream))})
			require.Nil(t, err)
			require.Equal(t, tc.input, usage.PromptTokens)
			require.Equal(t, tc.output, usage.CompletionTokens)
			require.Equal(t, tc.cache, usage.PromptTokensDetails.CachedTokens)
		})
	}
}
