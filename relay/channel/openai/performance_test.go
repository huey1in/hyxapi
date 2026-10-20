package openai

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenAIStreamHealthUsesUpstreamTerminalFacts(t *testing.T) {
	previous := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previous })
	for _, tc := range []struct {
		name, protocol, payload string
		want                    perfmetrics.Outcome
	}{
		{"chat complete", "chat", `{"choices":[{"delta":{},"finish_reason":"stop"}]}`, perfmetrics.OutcomeSuccess},
		{"chat truncated", "chat", `{"choices":[{"delta":{"content":"partial"}}]}`, perfmetrics.OutcomeFailure},
		{"chat content filter", "chat", `{"choices":[{"delta":{},"finish_reason":"content_filter"}]}`, perfmetrics.OutcomeIgnored},
		{"chat malformed", "chat", `{`, perfmetrics.OutcomeFailure},
		{"responses complete", "responses", `{"type":"response.completed","response":{"status":"completed","output":[]}}`, perfmetrics.OutcomeSuccess},
		{"responses truncated", "responses", `{"type":"response.output_text.delta","delta":"partial"}`, perfmetrics.OutcomeFailure},
		{"responses limited", "responses", `{"type":"response.incomplete","response":{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}`, perfmetrics.OutcomeSuccess},
		{"responses safety", "responses", `{"type":"response.incomplete","response":{"status":"incomplete","incomplete_details":{"reason":"content_filter"}}}`, perfmetrics.OutcomeIgnored},
		{"responses failed", "responses", `{"type":"response.failed","response":{"status":"failed","error":{"type":"server_error","code":"server_error"}}}`, perfmetrics.OutcomeFailure},
		{"chat bridge truncated", "chat-bridge", `{"choices":[{"delta":{"content":"partial"}}]}`, perfmetrics.OutcomeFailure},
		{"responses bridge truncated", "responses-bridge", `{"type":"response.output_text.delta","delta":"partial"}`, perfmetrics.OutcomeFailure},
		{"buffered responses truncated", "buffered", `{"type":"response.output_text.delta","delta":"partial"}`, perfmetrics.OutcomeFailure},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			info := &relaycommon.RelayInfo{
				IsStream: true, DisablePing: true, RelayFormat: types.RelayFormatOpenAI,
				RelayMode:   relayconstant.RelayModeChatCompletions,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI, UpstreamModelName: "gpt-test"},
			}
			response := &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader("data: " + tc.payload + "\n\n"))}
			var apiErr *types.NewAPIError
			switch tc.protocol {
			case "chat":
				_, apiErr = OaiStreamHandler(c, info, response)
			case "responses":
				_, apiErr = OaiResponsesStreamHandler(c, info, response)
			case "chat-bridge":
				info.RelayFormat = types.RelayFormatOpenAIResponses
				_, apiErr = OaiChatToResponsesStreamHandler(c, info, response)
			case "responses-bridge":
				_, apiErr = OaiResponsesToChatStreamHandler(c, info, response)
			case "buffered":
				info.IsStream = false
				_, apiErr = OaiResponsesToChatBufferedStreamHandler(c, info, response)
			}
			require.Equal(t, tc.want, perfmetrics.ClassifyRelayOutcome(context.Background(), info, apiErr))
		})
	}
}
