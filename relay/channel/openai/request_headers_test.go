package openai

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenRouterRequestUsesSiteIdentity(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://gateway.example.com"
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	for _, custom := range []bool{false, true} {
		header := http.Header{}
		if custom {
			header.Set("HTTP-Referer", "https://custom.example.com")
			header.Set("X-OpenRouter-Title", "Custom gateway")
		}
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenRouter, ApiKey: "test-key"}}

		require.NoError(t, (&Adaptor{}).SetupRequestHeader(ctx, &header, info))

		require.Equal(t, "Bearer test-key", header.Get("Authorization"))
		if custom {
			require.Equal(t, "https://custom.example.com", header.Get("HTTP-Referer"))
			require.Equal(t, "Custom gateway", header.Get("X-OpenRouter-Title"))
		} else {
			require.Equal(t, system_setting.ServerAddress, header.Get("HTTP-Referer"))
			require.Equal(t, "HyxAPI", header.Get("X-OpenRouter-Title"))
		}
	}
}
