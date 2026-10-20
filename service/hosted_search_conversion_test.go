package service_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/ali"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	"github.com/QuantumNous/new-api/relay/channel/zhipu_4v"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestHostedSearchConversionAndAttemptEvidence(t *testing.T) {
	for _, channel := range []int{constant.ChannelTypeAli, constant.ChannelTypeZhipu_v4} {
		for _, forced := range []bool{false, true} {
			t.Run(map[int]string{constant.ChannelTypeAli: "ali", constant.ChannelTypeZhipu_v4: "zhipu"}[channel]+map[bool]string{false: " auto", true: " forced"}[forced], func(t *testing.T) {
				info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude, RelayMode: relayconstant.RelayModeChatCompletions, OriginModelName: "search-model", ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channel, UpstreamModelName: "search-model"}}
				if channel == constant.ChannelTypeAli {
					(&ali.Adaptor{}).Init(info)
				} else {
					(&zhipu_4v.Adaptor{}).Init(info)
				}
				request := &dto.ClaudeRequest{Model: "search-model", Messages: []dto.ClaudeMessage{{Role: "user", Content: "search"}}, Tools: []any{map[string]any{"type": "web_search_20250305", "name": "web_search", "allowed_domains": []string{"example.com"}}}}
				if forced {
					request.ToolChoice = map[string]any{"type": "tool", "name": "web_search"}
				}
				converted, err := service.ConvertRequest(nil, info, types.RelayFormatOpenAI, request)
				require.NoError(t, err)
				raw, err := json.Marshal(converted.Value)
				require.NoError(t, err)
				key := "search_strategy_turbo"
				if channel == constant.ChannelTypeAli {
					require.True(t, gjson.GetBytes(raw, "enable_search").Bool())
					require.Equal(t, "example.com", gjson.GetBytes(raw, "search_options.assigned_site_list.0").String())
					require.Equal(t, forced, gjson.GetBytes(raw, "search_options.forced_search").Bool())
					require.False(t, gjson.GetBytes(raw, "search_options.search_strategy").Exists())
				} else {
					key = "search_std"
					require.Equal(t, "search_std", gjson.GetBytes(raw, "tools.0.web_search.search_engine").String())
					require.Equal(t, "example.com", gjson.GetBytes(raw, "tools.0.web_search.search_domain_filter").String())
					require.True(t, gjson.GetBytes(raw, "tools.0.web_search.search_result").Bool())
					if forced {
						require.True(t, gjson.GetBytes(raw, "tools.0.web_search.search_intent").Exists())
						require.False(t, gjson.GetBytes(raw, "tools.0.web_search.search_intent").Bool())
					}
				}
				if forced {
					require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[key].CallCount)
				} else if info.ResponsesUsageInfo != nil {
					require.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, key)
				}
				info.SetBillableToolCount("unrelated", 2)
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				info.InitChannelMeta(c)
				require.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, key)
				require.Equal(t, 2, info.ResponsesUsageInfo.BuiltInTools["unrelated"].CallCount)
				require.Nil(t, info.VendorToolUsage)
				require.Empty(t, info.WebSearchBillingKey)
				require.Nil(t, info.ConvOptions().WebSearch)
			})
		}
	}
}

func TestZhipuChatSearchResultsConfirmOneCall(t *testing.T) {
	for _, forced := range []bool{false, true} {
		for _, results := range []string{`[]`, `[{"title":"a"},{"title":"b"}]`} {
			info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude, RelayMode: relayconstant.RelayModeChatCompletions, ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeZhipu_v4}, StreamStatus: relaycommon.NewStreamStatus()}
			(&zhipu_4v.Adaptor{}).Init(info)
			var request dto.ClaudeRequest
			require.NoError(t, common.UnmarshalJsonStr(`{"model":"glm-test","messages":[{"role":"user","content":"search"}],"tools":[{"type":"web_search_20250305","name":"web_search"}]}`, &request))
			if forced {
				request.ToolChoice = map[string]any{"type": "tool", "name": "web_search"}
			}
			_, err := service.ConvertRequest(nil, info, types.RelayFormatOpenAI, &request)
			require.NoError(t, err)
			info.RelayFormat = types.RelayFormatOpenAI
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			raw := `{"model":"glm-test","choices":[{"index":0,"message":{"role":"assistant","content":"result"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12},"web_search":` + results + `}`
			_, apiErr := openai.OpenaiHandler(c, info, &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(raw))})
			require.Nil(t, apiErr)
			if forced || results != `[]` {
				require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["search_std"].CallCount)
			} else if info.ResponsesUsageInfo != nil {
				require.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, "search_std")
			}
		}
	}
}

func TestHostedSearchDomainLossHonorsSafePolicy(t *testing.T) {
	for _, channel := range []int{constant.ChannelTypeAli, constant.ChannelTypeZhipu_v4} {
		info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude, OriginModelName: "search-model", ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channel, UpstreamModelName: "search-model", ChannelOtherSettings: dto.ChannelOtherSettings{ToolLossPolicy: "safe"}}}
		if channel == constant.ChannelTypeAli {
			(&ali.Adaptor{}).Init(info)
		} else {
			(&zhipu_4v.Adaptor{}).Init(info)
		}
		var request dto.ClaudeRequest
		require.NoError(t, common.UnmarshalJsonStr(`{"model":"search-model","messages":[{"role":"user","content":"search"}],"tools":[{"type":"web_search_20250305","name":"web_search","blocked_domains":["example.com"]}]}`, &request))
		_, err := service.ConvertRequest(nil, info, types.RelayFormatOpenAI, &request)
		require.Error(t, err, "unsupported exclusions must not silently search blocked domains")
	}
}
