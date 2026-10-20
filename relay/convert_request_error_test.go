package relay

import (
	"encoding/json"
	"net/http"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/require"
)

func TestLossyRequestPolicyReturnsBadRequestWithoutRetry(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{ToolLossPolicy: "safe"},
		},
	}
	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: "Run this"}}}},
		Tools:    json.RawMessage(`[{"codeExecution":{}}]`),
	}
	_, err := service.ConvertRequest(nil, info, types.RelayFormatOpenAI, request)
	require.Error(t, err)
	apiErr := newConvertRequestFailedError(nil, info, err)
	require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	require.True(t, types.IsSkipRetryError(apiErr))
}
