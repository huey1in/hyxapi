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
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGeminiNativeStreamUsageSnapshotsPreserveModalities(t *testing.T) {
	previousTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = previousTimeout })
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-3-flash-preview:streamGenerateContent", nil)
	info := &relaycommon.RelayInfo{OriginModelName: "gemini-3-flash-preview", ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gemini-3-flash-preview"}}
	first := `data: {"usageMetadata":{"promptTokenCount":1100,"candidatesTokenCount":2,"promptTokensDetails":[{"modality":"IMAGE","tokenCount":1089},{"modality":"TEXT","tokenCount":11}],"candidatesTokensDetails":[{"modality":"TEXT","tokenCount":2}]}}` + "\n\n"
	last := `data: {"usageMetadata":{"candidatesTokenCount":7,"candidatesTokensDetails":[{"modality":"TEXT","tokenCount":7}]}}` + "\n\ndata: [DONE]\n\n"
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(first + first + last))}
	usage, apiErr := geminiStreamHandler(c, info, resp, func(string, *dto.GeminiChatResponse) bool { return true })
	require.Nil(t, apiErr)
	require.Equal(t, 1100, usage.PromptTokens)
	require.Equal(t, 7, usage.CompletionTokens)
	require.Equal(t, 1107, usage.TotalTokens)
	require.Equal(t, 1089, usage.PromptTokensDetails.ImageTokens)
	require.Equal(t, 11, usage.PromptTokensDetails.TextTokens)
	require.Equal(t, 7, usage.CompletionTokenDetails.TextTokens)
	require.Equal(t, 1089, usage.BillingUsage.GeminiUsageMetadata.PromptTokensDetails[0].TokenCount)
}
