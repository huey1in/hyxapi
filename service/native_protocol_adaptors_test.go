package service_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/aws"
	"github.com/QuantumNous/new-api/relay/channel/deepseek"
	"github.com/QuantumNous/new-api/relay/channel/moonshot"
	"github.com/QuantumNous/new-api/relay/channel/newapi"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	"github.com/QuantumNous/new-api/relay/channel/vertex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestNativeClaudeAdaptorsApplyMaxTokensBeforeProviderWrapping(t *testing.T) {
	for _, tc := range []struct {
		name    string
		adaptor channel.Adaptor
	}{
		{"newapi", &newapi.Adaptor{}}, {"aws", &aws.Adaptor{}}, {"vertex", &vertex.Adaptor{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/messages", nil)
			info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude, OriginModelName: "claude-sonnet-4-5", ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "claude-sonnet-4-5"}}
			request := &dto.ClaudeRequest{Model: "claude-sonnet-4-5", Messages: []dto.ClaudeMessage{{Role: "user", Content: "hello"}}}
			converted, err := tc.adaptor.ConvertClaudeRequest(c, info, request)
			require.NoError(t, err)
			raw, err := json.Marshal(converted)
			require.NoError(t, err)
			require.Positive(t, gjson.GetBytes(raw, "max_tokens").Int())
			require.Equal(t, "hello", gjson.GetBytes(raw, "messages.0.content").String())
		})
	}
}

func TestOpenAIReasoningDialectProjection(t *testing.T) {
	for _, kind := range []int{constant.ChannelTypeOpenAI, constant.ChannelTypeOpenRouter} {
		info := &relaycommon.RelayInfo{OriginModelName: "gpt-5", ChannelMeta: &relaycommon.ChannelMeta{ChannelType: kind, UpstreamModelName: "gpt-5"}}
		request := &dto.GeneralOpenAIRequest{Model: "gpt-5", Reasoning: json.RawMessage(`{"enabled":false,"exclude":true}`)}
		_, err := (&openai.Adaptor{}).ConvertOpenAIRequest(nil, info, request)
		require.NoError(t, err)
		require.Equal(t, "none", info.ReasoningEffort)
		if kind == constant.ChannelTypeOpenAI {
			require.Equal(t, "none", request.ReasoningEffort)
			require.Empty(t, request.Reasoning)
		} else {
			require.Empty(t, request.ReasoningEffort)
			require.False(t, gjson.GetBytes(request.Reasoning, "enabled").Bool())
			require.True(t, gjson.GetBytes(request.Reasoning, "exclude").Bool())
		}
	}
}

func TestDeepSeekUsesNormalizedModifierAfterModelNameIsResolved(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "deepseek-v4-pro@thinking:off", ReasoningConversion: &dto.ReasoningConversionState{Mode: "disabled", Effort: "none"}, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "deepseek-v4-pro"}}
	request := &dto.GeneralOpenAIRequest{Model: "deepseek-v4-pro", Reasoning: json.RawMessage(`{"effort":"high"}`)}
	_, err := (&deepseek.Adaptor{}).ConvertOpenAIRequest(nil, info, request)
	require.NoError(t, err)
	require.JSONEq(t, `{"type":"disabled"}`, string(request.THINKING))
	require.Empty(t, request.Reasoning)
	require.Equal(t, "none", info.ReasoningEffort)
	require.Equal(t, "deepseek-v4-pro", request.Model)
}

func TestMoonshotResponsesUsesNativeEndpoint(t *testing.T) {
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://moonshot.example"}}
	adaptor := &moonshot.Adaptor{}
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://moonshot.example/v1/responses", url)
	request := dto.OpenAIResponsesRequest{Model: "kimi-test", Input: json.RawMessage(`"hello"`)}
	value, err := adaptor.ConvertOpenAIResponsesRequest(nil, info, request)
	require.NoError(t, err)
	require.Equal(t, request, value)
}
