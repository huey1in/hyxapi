package gemini

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
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGeminiStreamHealthDistinguishesBlockedAndTruncated(t *testing.T) {
	previous := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = previous })
	for _, tc := range []struct {
		name, payload string
		want          perfmetrics.Outcome
	}{
		{"normal", `{"candidates":[{"finishReason":"STOP"}]}`, perfmetrics.OutcomeSuccess},
		{"token limit", `{"candidates":[{"finishReason":"MAX_TOKENS"}]}`, perfmetrics.OutcomeSuccess},
		{"safety finish", `{"candidates":[{"finishReason":"SAFETY"}]}`, perfmetrics.OutcomeIgnored},
		{"blocked prompt", `{"promptFeedback":{"blockReason":"SAFETY"}}`, perfmetrics.OutcomeIgnored},
		{"truncated", `{"candidates":[{"content":{"parts":[{"text":"partial"}]}}]}`, perfmetrics.OutcomeFailure},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini:streamGenerateContent", nil)
			info := &relaycommon.RelayInfo{IsStream: true, DisablePing: true, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-test"}}
			response := &http.Response{Body: io.NopCloser(strings.NewReader("data: " + tc.payload + "\n\n"))}
			_, apiErr := geminiStreamHandler(c, info, response, func(string, *dto.GeminiChatResponse) bool { return true })
			require.Equal(t, tc.want, perfmetrics.ClassifyRelayOutcome(context.Background(), info, apiErr))
		})
	}
}
