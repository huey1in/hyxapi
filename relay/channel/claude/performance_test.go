package claude

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
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestClaudeStreamHealthRequiresMessageStop(t *testing.T) {
	previous := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previous })
	start := "data: " + `{"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude-test","content":[],"usage":{"input_tokens":1,"output_tokens":0}}}` + "\n\n"
	for _, tc := range []struct {
		name, payload string
		responses     bool
		want          perfmetrics.Outcome
	}{
		{"complete", `{"type":"message_stop"}`, false, perfmetrics.OutcomeSuccess},
		{"truncated after delta", `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}`, false, perfmetrics.OutcomeFailure},
		{"refusal", `{"type":"message_delta","delta":{"stop_reason":"refusal"},"usage":{"output_tokens":0}}`, false, perfmetrics.OutcomeIgnored},
		{"responses bridge truncated", `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}`, true, perfmetrics.OutcomeFailure},
		{"responses bridge malformed", `{`, true, perfmetrics.OutcomeFailure},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
			info := &relaycommon.RelayInfo{IsStream: true, DisablePing: true, RelayFormat: types.RelayFormatClaude, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-test"}}
			response := &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(start + "data: " + tc.payload + "\n\n"))}
			var apiErr *types.NewAPIError
			if tc.responses {
				info.RelayFormat = types.RelayFormatOpenAIResponses
				_, apiErr = ClaudeResponsesStreamHandler(c, response, info)
			} else {
				_, apiErr = ClaudeStreamHandler(c, response, info)
			}
			require.Equal(t, tc.want, perfmetrics.ClassifyRelayOutcome(context.Background(), info, apiErr))
		})
	}
}
