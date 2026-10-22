package channel_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/baidu"
	"github.com/QuantumNous/new-api/relay/channel/mokaai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestEmbeddingAdaptersPreserveVectorsAndUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adapters := map[string]interface {
		DoResponse(*gin.Context, *http.Response, *relaycommon.RelayInfo) (any, *types.NewAPIError)
	}{
		"baidu":  &baidu.Adaptor{},
		"mokaai": &mokaai.Adaptor{},
	}
	for name, adapter := range adapters {
		for _, tc := range []struct {
			name, raw, data, mokaModel string
		}{
			{
				name:      "upstream model and vectors",
				raw:       `{"model":"served-m3e","data":[{"object":"embedding","index":2,"embedding":[0.25,-0.5]}],"usage":{"prompt_tokens":7,"total_tokens":7}}`,
				data:      `[{"object":"embedding","index":2,"embedding":[0.25,-0.5]}]`,
				mokaModel: "served-m3e",
			},
			{
				name: "omitted model and data",
				raw:  `{"usage":{"prompt_tokens":7,"total_tokens":7}}`,
				data: `[]`, mokaModel: "m3e-base",
			},
			{
				name: "null data",
				raw:  `{"data":null,"usage":{"prompt_tokens":7,"total_tokens":7}}`,
				data: `[]`, mokaModel: "m3e-base",
			},
		} {
			t.Run(name+"/"+tc.name, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				context, _ := gin.CreateTestContext(recorder)
				info := &relaycommon.RelayInfo{
					RelayMode:   constant.RelayModeEmbeddings,
					ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "m3e-base"},
				}
				usage, apiErr := adapter.DoResponse(context, &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(tc.raw)),
				}, info)
				require.Nil(t, apiErr)
				require.Equal(t, http.StatusOK, recorder.Code)
				require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
				var response struct {
					Object string          `json:"object"`
					Model  string          `json:"model"`
					Data   json.RawMessage `json:"data"`
					Usage  dto.Usage       `json:"usage"`
				}
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
				require.Equal(t, "list", response.Object)
				wantModel := "baidu-embedding"
				if name == "mokaai" {
					wantModel = tc.mokaModel
				}
				require.Equal(t, wantModel, response.Model)
				require.JSONEq(t, tc.data, string(response.Data))
				require.Equal(t, 7, response.Usage.PromptTokens)
				require.Equal(t, 7, response.Usage.TotalTokens)
				require.Equal(t, &response.Usage, usage)
			})
		}
	}
}
