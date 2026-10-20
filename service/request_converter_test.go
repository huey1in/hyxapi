package service

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResponsesCustomToolSurvivesGatewayGeminiRoundTrip(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3-flash-preview",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-3-flash-preview",
		},
	}
	request := &dto.OpenAIResponsesRequest{
		Model: "gemini-3-flash-preview",
		Input: json.RawMessage(`"Update the document"`),
		Tools: json.RawMessage(`[{"type":"custom","name":"apply_patch"}]`),
	}
	converted, err := ConvertRequest(nil, info, types.RelayFormatGemini, request)
	require.NoError(t, err)
	require.IsType(t, &dto.GeminiChatRequest{}, converted.Value)
	require.True(t, info.ResponsesToolState().IsCustomTool("apply_patch"))

	const input = "*** Begin Patch\n*** End Patch"
	var upstream dto.GeminiChatResponse
	data, err := json.Marshal(map[string]any{
		"candidates": []any{map[string]any{
			"content": map[string]any{
				"role": "model",
				"parts": []any{map[string]any{
					"functionCall": map[string]any{
						"id": "call_1", "name": "apply_patch", "args": map[string]string{"input": input},
					},
				}},
			},
			"finishReason": "STOP",
		}},
	})
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(data, &upstream))
	result, err := ConvertResponse(nil, info, types.RelayFormatOpenAIResponses, &upstream)
	require.NoError(t, err)
	response, ok := result.Value.(*dto.OpenAIResponsesResponse)
	require.True(t, ok)
	require.Len(t, response.Output, 1)
	require.Equal(t, "custom_tool_call", response.Output[0].Type)
	require.Equal(t, "apply_patch", response.Output[0].Name)
	var restored string
	require.NoError(t, json.Unmarshal(response.Output[0].Input, &restored))
	require.Equal(t, input, restored)
}

func TestConversionDiagnosticsContextPreservesMediaCleanup(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-sonnet-4-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-sonnet-4-5",
		},
	}
	var request dto.GeneralOpenAIRequest
	require.NoError(t, json.Unmarshal([]byte(`{
		"model":"claude-sonnet-4-5","max_tokens":128,
		"messages":[{"role":"user","content":[
			{"type":"image_url","image_url":{"url":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAf8AAAAASUVORK5CYII="}}
		]}]
	}`), &request))
	_, err := ConvertRequest(c, info, types.RelayFormatClaude, &request)
	require.NoError(t, err)
	registered, exists := c.Get(string(constant.ContextKeyFileSourcesToCleanup))
	require.True(t, exists, "wrapped conversion context must retain Gin's file cleanup registry")
	sources, ok := registered.([]types.FileSource)
	require.True(t, ok)
	require.NotEmpty(t, sources)
	CleanupFileSources(c)
	registered, _ = c.Get(string(constant.ContextKeyFileSourcesToCleanup))
	require.Nil(t, registered)
}
