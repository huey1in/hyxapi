package codex

import (
	"encoding/json"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLAlphaSearch(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeCodex,
			ChannelBaseUrl: "https://chatgpt.com",
		},
		RelayMode: relayconstant.RelayModeAlphaSearch,
	}

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://chatgpt.com/backend-api/codex/alpha/search", url)
}

func TestResponsesStripsUnsupportedPenalties(t *testing.T) {
	var req dto.OpenAIResponsesRequest
	require.NoError(t, json.Unmarshal([]byte(`{"model":"gpt-5","frequency_penalty":0.5,"presence_penalty":0.3}`), &req))
	result, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses, ChannelMeta: &relaycommon.ChannelMeta{}}, req)
	require.NoError(t, err)
	wire, err := json.Marshal(result)
	require.NoError(t, err)
	var fields map[string]any
	require.NoError(t, json.Unmarshal(wire, &fields))
	assert.NotContains(t, fields, "frequency_penalty")
	assert.NotContains(t, fields, "presence_penalty")
	assert.Equal(t, false, fields["store"])
}
