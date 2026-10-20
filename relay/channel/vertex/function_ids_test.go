package vertex

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestVertexDropsUnsupportedIdentityOnBothToolSidesAndBatch(t *testing.T) {
	var request dto.GeminiChatRequest
	require.NoError(t, json.Unmarshal([]byte(`{"contents":[{"role":"model","parts":[{"functionCall":{"id":"call-1","name":"lookup","args":{}}},{"functionResponse":{"id":"call-1","name":"lookup","response":{"ok":true}}}]}],"requests":[{"contents":[{"parts":[{"functionCall":{"id":"call-2","name":"lookup","args":{}}}]}]}]}`), &request))
	removeFunctionCallIDs(&request)
	require.Empty(t, request.Contents[0].Parts[0].FunctionCall.ID)
	require.Empty(t, request.Contents[0].Parts[1].FunctionResponse.ID)
	require.Empty(t, request.Requests[0].Contents[0].Parts[0].FunctionCall.ID)
	require.Equal(t, "lookup", request.Contents[0].Parts[0].FunctionCall.FunctionName)
	require.Equal(t, map[string]any{"ok": true}, request.Contents[0].Parts[1].FunctionResponse.Response)
}
