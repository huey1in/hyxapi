package claude

import (
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClaudeStreamFinalUsageEstimatesOnlyUncountedUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, startUsage, deltaUsage, stopReason string // no deltaUsage: the stream broke before message_delta
		streamText                               bool
		wantInput, wantOutput                    int
		wantLocalCount                           bool
	}{
		{name: "cache-only refusal keeps zeros", startUsage: `{"input_tokens":0,"output_tokens":0,"cache_creation_input_tokens":20000,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":20000}}`, deltaUsage: `{"output_tokens":0}`, stopReason: "refusal"},
		{name: "broken stream keeps cache-only input", startUsage: `{"input_tokens":0,"output_tokens":1,"cache_read_input_tokens":50000}`, streamText: true, wantOutput: 2, wantLocalCount: true},
		{name: "zeros after streamed text are estimated", startUsage: `{"input_tokens":0,"output_tokens":0}`, deltaUsage: `{"output_tokens":0}`, stopReason: "end_turn", streamText: true, wantInput: 1200, wantOutput: 2, wantLocalCount: true},
		{name: "zero delta input keeps start input", startUsage: `{"input_tokens":1000,"output_tokens":1}`, deltaUsage: `{"input_tokens":0,"output_tokens":50}`, stopReason: "end_turn", streamText: true, wantInput: 1000, wantOutput: 50},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
			info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-opus-4-8"}}
			info.SetEstimatePromptTokens(1200)
			state := &ClaudeResponseInfo{Usage: &dto.Usage{}}
			start := fmt.Sprintf(`{"type":"message_start","message":{"id":"msg_1","model":"claude-opus-4-8","usage":%s}}`, tc.startUsage)
			require.Nil(t, HandleStreamResponseData(c, info, state, start))
			if tc.streamText {
				require.Nil(t, HandleStreamResponseData(c, info, state, `{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}`))
			}
			if tc.deltaUsage != "" {
				delta := fmt.Sprintf(`{"type":"message_delta","delta":{"stop_reason":%q},"usage":%s}`, tc.stopReason, tc.deltaUsage)
				require.Nil(t, HandleStreamResponseData(c, info, state, delta))
				require.Nil(t, HandleStreamResponseData(c, info, state, `{"type":"message_stop"}`))
			}
			HandleStreamFinalResponse(c, info, state)
			assert.Equal(t, tc.wantInput, state.Usage.PromptTokens)
			assert.Equal(t, tc.wantOutput, state.Usage.CompletionTokens)
			assert.Equal(t, tc.wantLocalCount, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
			require.NotNil(t, state.Usage.BillingUsage)
			canonical := state.Usage.BillingUsage.ClaudeUsage
			require.NotNil(t, canonical)
			assert.Equal(t, tc.wantInput, canonical.InputTokens, "settlement must bill the same input")
			assert.Equal(t, tc.wantOutput, canonical.OutputTokens)
		})
	}
}
