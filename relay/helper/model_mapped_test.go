package helper

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelMappingFallsBackToBaseAndPreservesExactOverride(t *testing.T) {
	for _, test := range []struct {
		name    string
		mapping string
		want    string
	}{
		{"base mapping", `{"gpt-5.4":"gpt-5.4-2026-03-05"}`, "gpt-5.4-2026-03-05"},
		{"exact override", `{"gpt-5.4":"base-alias","gpt-5.4@effort:high":"high-alias"}`, "high-alias"},
		{"chained mapping", `{"gpt-5.4":"alias@effort:high","alias":"gpt-5.4-2026-03-05"}`, "gpt-5.4-2026-03-05"},
	} {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("model_mapping", test.mapping)
			request := &dto.GeneralOpenAIRequest{Model: "gpt-5.4@effort:high"}
			info := &relaycommon.RelayInfo{
				OriginModelName: request.Model,
				ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: request.Model},
			}
			require.NoError(t, ModelMappedHelper(c, info, request))
			require.True(t, info.IsModelMapped)
			require.Equal(t, test.want, info.UpstreamModelName)
			require.Equal(t, test.want, request.Model)
		})
	}
}
