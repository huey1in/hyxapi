package deepseek

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURL(t *testing.T) {
	adaptor := &Adaptor{}

	claudeURL, err := adaptor.GetRequestURL(&relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.deepseek.com"},
	})
	require.NoError(t, err)
	require.Equal(t, "https://api.deepseek.com/anthropic/v1/messages", claudeURL)

	responsesURL, err := adaptor.GetRequestURL(&relaycommon.RelayInfo{
		RelayMode:   constant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.deepseek.com"},
	})
	require.NoError(t, err)
	require.Equal(t, "https://api.deepseek.com/responses", responsesURL)
}

func TestApplyDeepSeekV4OpenAIThinkingSuffix(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{Model: "deepseek-v4-pro-max"}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: request.Model}}

	require.NoError(t, applyDeepSeekV4OpenAIThinkingSuffix(info, request))
	require.Equal(t, "deepseek-v4-pro", request.Model)
	require.JSONEq(t, `{"type":"enabled"}`, string(request.THINKING))
	require.Equal(t, "max", request.ReasoningEffort)
	require.Equal(t, "deepseek-v4-pro", info.UpstreamModelName)
}

func TestApplyDeepSeekV4ResponsesThinkingSuffix(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{Model: "deepseek-v4-flash-none"}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: request.Model}}

	applyDeepSeekV4ResponsesThinkingSuffix(info, request)
	require.Equal(t, "deepseek-v4-flash", request.Model)
	require.NotNil(t, request.Reasoning)
	require.Equal(t, "none", request.Reasoning.Effort)
	require.Equal(t, "none", info.ReasoningEffort)
}
