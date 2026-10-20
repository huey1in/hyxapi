package gemini

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGeminiGroundingCountsUniqueQueriesForAllResponseFormats(t *testing.T) {
	for _, format := range []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatGemini, types.RelayFormatOpenAIResponses} {
		t.Run(string(format), func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/responses", nil)
			info := newGeminiResponsesRelayInfo(false)
			info.RelayFormat = format
			raw := `{"candidates":[{"content":{"role":"model","parts":[{"text":"result"}]},"finishReason":"STOP","groundingMetadata":{"webSearchQueries":["one","one"," "," two "],"imageSearchQueries":["two","three"]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":2,"totalTokenCount":12}}`
			resp := &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(raw))}
			var apiErr *types.NewAPIError
			switch format {
			case types.RelayFormatGemini:
				_, apiErr = GeminiTextGenerationHandler(c, info, resp)
			case types.RelayFormatOpenAIResponses:
				_, apiErr = GeminiResponsesHandler(c, info, resp)
			default:
				_, apiErr = GeminiChatHandler(c, info, resp)
			}
			require.Nil(t, apiErr)
			require.Equal(t, 3, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolGoogleSearch].CallCount)
			require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[relaycommon.GoogleSearchGroundedPromptTool].CallCount)
		})
	}
}

func TestGeminiStreamGroundingAndPartialUsageKeepEarlierCache(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	info := newGeminiResponsesRelayInfo(true)
	stream := "data: " + `{"candidates":[{"content":{"role":"model","parts":[{"text":"a"}]},"groundingMetadata":{"webSearchQueries":["one","one"]}}],"usageMetadata":{"promptTokenCount":100,"cachedContentTokenCount":80}}` + "\n\ndata: " + `{"candidates":[{"content":{"role":"model","parts":[{"text":"b"}]},"finishReason":"STOP","groundingMetadata":{"webSearchQueries":["one","two"],"imageSearchQueries":["three",""]}}],"usageMetadata":{"candidatesTokenCount":7}}` + "\n\ndata: [DONE]\n\n"
	usage, err := geminiStreamHandler(c, info, &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(stream))}, func(string, *dto.GeminiChatResponse) bool { return true })
	require.Nil(t, err)
	require.Equal(t, 100, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 80, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 80, usage.BillingUsage.GeminiUsageMetadata.CachedContentTokenCount)
	require.Equal(t, 3, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolGoogleSearch].CallCount)
	require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[relaycommon.GoogleSearchGroundedPromptTool].CallCount)
}
