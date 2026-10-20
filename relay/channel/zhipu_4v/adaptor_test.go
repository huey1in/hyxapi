package zhipu_4v

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestGeminiSearchReachesZhipuNativeTool(t *testing.T) {
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatGemini, RelayMode: relayconstant.RelayModeChatCompletions, OriginModelName: "glm-test", ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "glm-test"}}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	var request dto.GeminiChatRequest
	require.NoError(t, common.UnmarshalJsonStr(`{"model":"glm-test","contents":[{"role":"user","parts":[{"text":"search"}]}],"tools":[{"googleSearch":{}}]}`, &request))
	converted, err := adaptor.ConvertGeminiRequest(nil, info, &request)
	require.NoError(t, err)
	raw, err := json.Marshal(converted)
	require.NoError(t, err)
	require.Equal(t, "search_std", gjson.GetBytes(raw, "tools.0.web_search.search_engine").String())
	require.Equal(t, "search", gjson.GetBytes(raw, "messages.0.content").String())
}

func TestResponsesAndReasoningSettingsPreserved(t *testing.T) {
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://glm.example"}}
	adaptor := &Adaptor{}
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://glm.example/api/v1/responses", url)
	request := dto.OpenAIResponsesRequest{Model: "glm-test", Input: json.RawMessage(`"hello"`)}
	value, err := adaptor.ConvertOpenAIResponsesRequest(nil, info, request)
	require.NoError(t, err)
	require.Equal(t, request, value)
	chat := requestOpenAI2Zhipu(dto.GeneralOpenAIRequest{Model: "glm-test", ReasoningEffort: "high"})
	require.Equal(t, "high", chat.ReasoningEffort)
}
