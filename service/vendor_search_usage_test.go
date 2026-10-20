package service_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/ali"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	"github.com/QuantumNous/new-api/relay/channel/xai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestVendorSearchCountsReplaceProtocolItemsInResponsesAndStreams(t *testing.T) {
	for _, tc := range []struct {
		name     string
		channel  int
		facts    string
		expected map[string]int
	}{
		{"azure", constant.ChannelTypeAzure, `"tool_usage":{"web_search":{"num_requests":3}}`, map[string]int{"bing_web_search": 3, "web_search": 0, "web_search_preview": 0}},
		{"azure zero", constant.ChannelTypeAzure, `"tool_usage":{"web_search":{"num_requests":0}}`, map[string]int{"bing_web_search": 0, "web_search": 0, "web_search_preview": 0}},
		{"ali", constant.ChannelTypeAli, `"usage":{"input_tokens":10,"output_tokens":2,"x_tools":{"web_search":{"count":3}}}`, map[string]int{"search_strategy_agent": 3, "web_search": 0, "web_search_preview": 0}},
		{"ali zero", constant.ChannelTypeAli, `"usage":{"input_tokens":10,"output_tokens":2,"x_tools":{"web_search":{"count":0}}}`, map[string]int{"search_strategy_agent": 0, "web_search": 0, "web_search_preview": 0}},
		{"xai", constant.ChannelTypeXai, `"usage":{"input_tokens":10,"output_tokens":2,"server_side_tool_usage_details":{"web_search_calls":2,"x_posts_fetched":4,"x_users_fetched":1}}`, map[string]int{"web_search": 2, "web_search_preview": 0, "x_search_posts": 4, "x_search_profiles": 1}},
	} {
		for _, stream := range []bool{false, true} {
			t.Run(tc.name+map[bool]string{true: " stream", false: " response"}[stream], func(t *testing.T) {
				info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses, ChannelMeta: &relaycommon.ChannelMeta{ChannelType: tc.channel}, StreamStatus: relaycommon.NewStreamStatus()}
				if tc.channel == constant.ChannelTypeAzure {
					(&openai.Adaptor{}).Init(info)
				} else if tc.channel == constant.ChannelTypeAli {
					(&ali.Adaptor{}).Init(info)
				} else {
					(&xai.Adaptor{}).Init(info)
				}
				info.SetBillableToolCount("unrelated", 7)
				info.ResponsesUsageInfo.BuiltInTools["unrelated"].SearchContextSize = "high"
				info.SetBillableToolCount("unrelated", 7)
				tool := `{"type":"web_search_call","id":"search-1","status":"completed"}`
				response := `{"object":"response","status":"completed","model":"test","output":[` + tool + `],` + tc.facts + `}`
				if stream {
					accumulator := service.NewResponsesUsageAccumulator(info)
					for _, raw := range []string{`{"type":"response.output_item.done","output_index":0,"item":` + tool + `}`, `{"type":"response.completed","response":` + response + `}`} {
						var event dto.ResponsesStreamResponse
						require.NoError(t, common.UnmarshalJsonStr(raw, &event))
						accumulator.Observe(&event, []byte(raw))
					}
					accumulator.Finish()
				} else {
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
					_, apiErr := openai.OaiResponsesHandler(c, info, &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(response))})
					require.Nil(t, apiErr)
				}
				for key, count := range tc.expected {
					require.Equal(t, count, info.ResponsesUsageInfo.BuiltInTools[key].CallCount, key)
				}
				require.Equal(t, 7, info.ResponsesUsageInfo.BuiltInTools["unrelated"].CallCount)
				require.Equal(t, "high", info.ResponsesUsageInfo.BuiltInTools["unrelated"].SearchContextSize)
			})
		}
	}
}
