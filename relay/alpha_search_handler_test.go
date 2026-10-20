package relay

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildAlphaSearchRequestBodyPreservesUnknownFields(t *testing.T) {
	raw := []byte(`{
		"id":"req_1",
		"model":"gpt-5.1",
		"input":[{"role":"user","content":"hi"}],
		"commands":{"search_query":[{"q":"weather","recency":1}]},
		"settings":{"locale":"en"},
		"future_field":{"nested":true}
	}`)

	out, err := buildAlphaSearchRequestBody(raw, "gpt-5.1", "gpt-5.1-mapped")
	require.NoError(t, err)

	var body map[string]any
	require.NoError(t, common.Unmarshal(out, &body))
	assert.Equal(t, "gpt-5.1-mapped", body["model"])
	assert.Equal(t, "req_1", body["id"])
	require.Contains(t, body, "commands")
	require.Contains(t, body, "settings")
	require.Contains(t, body, "future_field")
	require.Contains(t, body, "input")

	commands, ok := body["commands"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, commands, "search_query")

	future, ok := body["future_field"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, true, future["nested"])
}

func TestBuildAlphaSearchRequestBodyNoMappingKeepsRawBytes(t *testing.T) {
	raw := []byte(`{"model":"gpt-5.1","commands":{"search_query":[{"q":"x"}]},"future_field":1}`)
	out, err := buildAlphaSearchRequestBody(raw, "gpt-5.1", "gpt-5.1")
	require.NoError(t, err)
	assert.Equal(t, raw, out)
}

func TestAlphaSearchModelMappingPreservesLargeUnknownNumbers(t *testing.T) {
	raw := []byte(`{"model":"alias","future_integer":9007199254740993,"commands":{"search_query":[{"q":"test"}]}}`)
	out, err := buildAlphaSearchRequestBody(raw, "alias", "mapped")
	require.NoError(t, err)
	require.Contains(t, string(out), `"future_integer":9007199254740993`)
	require.Contains(t, string(out), `"model":"mapped"`)
	_, err = buildAlphaSearchRequestBody([]byte(`{`), "alias", "mapped")
	require.Error(t, err)
}

func TestAlphaSearchHelperForwardsRawResultsAndBillsOneSearch(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)
	batch, logConsume := common.BatchUpdateEnabled, common.LogConsumeEnabled
	common.BatchUpdateEnabled, common.LogConsumeEnabled = true, false
	t.Cleanup(func() { common.BatchUpdateEnabled, common.LogConsumeEnabled = batch, logConsume })
	for _, tc := range []struct {
		name            string
		channel, status int
	}{
		{"newapi", constant.ChannelTypeNewAPI, 200},
		{"sub2api", constant.ChannelTypeSub2API, 200},
		{"upstream failure", constant.ChannelTypeNewAPI, 429},
		{"unsupported channel", constant.ChannelTypeOpenAI, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls int
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				require.Equal(t, "/v1/alpha/search", r.URL.Path)
				require.Equal(t, "Bearer search-key", r.Header.Get("Authorization"))
				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				require.Contains(t, string(body), `"model":"mapped"`)
				require.Contains(t, string(body), `"future_integer":9007199254740993`)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				if tc.status == 200 {
					_, _ = io.WriteString(w, `{"results":[{"title":"unchanged"}],"future":true}`)
				} else {
					_, _ = io.WriteString(w, `{"error":{"message":"search quota exceeded","code":"rate_limit"}}`)
				}
			}))
			defer upstream.Close()
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/alpha/search", strings.NewReader(`{"model":"alias","future_integer":9007199254740993,"commands":{"search_query":[{"q":"test"}]}}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("model_mapping", `{"alias":"mapped"}`)
			common.SetContextKey(c, constant.ContextKeyChannelType, tc.channel)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyChannelKey, "search-key")
			common.SetContextKey(c, constant.ContextKeyOriginalModel, "alias")
			request, err := helper.GetAndValidateRequest(c, types.RelayFormatOpenAIAlphaSearch)
			require.NoError(t, err)
			info, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIAlphaSearch, request, nil)
			require.NoError(t, err)
			info.PriceData.GroupRatioInfo = hosttypes.GroupRatioInfo{GroupRatio: 1.5}
			settlement := &recordedSettlement{}
			info.Billing = settlement
			apiErr := AlphaSearchHelper(c, info)
			if tc.channel == constant.ChannelTypeOpenAI {
				require.NotNil(t, apiErr)
				require.False(t, types.IsSkipRetryError(apiErr))
				require.Zero(t, calls)
			} else if tc.status != 200 {
				require.NotNil(t, apiErr)
				require.Equal(t, tc.status, apiErr.StatusCode)
				require.Empty(t, settlement.settled)
			} else {
				require.Nil(t, apiErr)
				require.Equal(t, []int{7500}, settlement.settled)
				require.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["web_search_preview"].CallCount)
			}
		})
	}
}

type recordedSettlement struct {
	settled  []int
	refunded bool
}

func (s *recordedSettlement) Settle(quota int) error {
	s.settled = append(s.settled, quota)
	return nil
}
func (s *recordedSettlement) Refund(*gin.Context)    { s.refunded = true }
func (*recordedSettlement) NeedsRefund() bool        { return false }
func (*recordedSettlement) GetPreConsumedQuota() int { return 0 }
func (*recordedSettlement) Reserve(int) error        { return nil }

// /v1/tools/search and /v1/tools/fetch follow /v1/alpha/search: the raw body
// reaches /v1/tools/* unchanged and the response returns unchanged. With only
// the built-in prices, a response DeepSeek bills (results, page content)
// settles one call at the routing name's request price and no tokens, an
// empty one releases the reservation, an upstream error keeps its status, and
// a channel that cannot relay the endpoint fails retryably without sending
// anything.
func TestDeepSeekToolsHelper(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)
	batch, logConsume := common.BatchUpdateEnabled, common.LogConsumeEnabled
	common.BatchUpdateEnabled, common.LogConsumeEnabled = true, false
	t.Cleanup(func() { common.BatchUpdateEnabled, common.LogConsumeEnabled = batch, logConsume })

	const search, fetch = "/v1/tools/search", "/v1/tools/fetch"
	const results = `{"results":[{"title":"DeepSeek","url":"https://deepseek.com/","rerank_score":2.1}]}`
	tests := []struct {
		name, path, body, response string
		channelType, status        int
		settled                    []int
		refunded                   bool
	}{
		{name: "search with results", path: search, body: `{"query":"deepseek","count":2,"future_field":{"nested":true}}`,
			response: results, channelType: constant.ChannelTypeDeepSeek, status: http.StatusOK, settled: []int{375}},
		{name: "search without results", path: search, body: `{"query":"site:none.invalid deepseek"}`,
			response: `{"results":[]}`, channelType: constant.ChannelTypeDeepSeek, status: http.StatusOK, refunded: true},
		{name: "fetch with page content", path: fetch, body: `{"url":"https://example.com/"}`,
			response: `{"title":"Example Domain","content":"# Example Domain"}`, channelType: constant.ChannelTypeDeepSeek, status: http.StatusOK, settled: []int{375}},
		{name: "fetch failure keeps its status", path: fetch, body: `{"url":"https://example.com/missing"}`,
			response:    `{"error":{"message":"failed to fetch URL","type":"not_found_error","param":null,"code":"invalid_request_error"}}`,
			channelType: constant.ChannelTypeDeepSeek, status: http.StatusNotFound},
		{name: "search through a New API channel", path: search, body: `{"query":"deepseek"}`,
			response: results, channelType: constant.ChannelTypeNewAPI, status: http.StatusOK, settled: []int{375}},
		{name: "channel without the endpoint", path: search, body: `{"query":"deepseek"}`, channelType: constant.ChannelTypeOpenAI},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var gotPath string
			var gotBody []byte
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				gotBody, _ = io.ReadAll(r.Body)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, tc.response)
			}))
			t.Cleanup(upstream.Close)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, tc.path, strings.NewReader(tc.body))
			c.Request.Header.Set("Content-Type", "application/json")
			routingName := map[string]string{search: constant.DeepSeekSearchModel, fetch: constant.DeepSeekFetchModel}[tc.path]
			common.SetContextKey(c, constant.ContextKeyOriginalModel, routingName)
			common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
			common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
			common.SetContextKey(c, constant.ContextKeyChannelType, tc.channelType)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, upstream.URL)
			common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-test")

			request, err := helper.GetAndValidateRequest(c, types.RelayFormatDeepSeekTools)
			require.NoError(t, err)
			info, err := relaycommon.GenRelayInfo(c, types.RelayFormatDeepSeekTools, request, nil)
			require.NoError(t, err)
			info.BillingRequestInput = &billingexpr.RequestInput{Body: []byte(tc.body)}
			_, err = helper.ModelPriceHelper(c, info, 0, request.GetTokenCountMeta())
			require.NoError(t, err, "the routing name is priced out of the box")
			settlement := &recordedSettlement{}
			info.Billing = settlement

			apiErr := DeepSeekToolsHelper(c, info)
			if tc.status == 0 {
				require.NotNil(t, apiErr)
				assert.False(t, types.IsSkipRetryError(apiErr))
				assert.Empty(t, gotPath)
				return
			}
			assert.Equal(t, tc.path, gotPath)
			assert.Equal(t, tc.body, string(gotBody))
			assert.Equal(t, tc.settled, settlement.settled)
			assert.Equal(t, tc.refunded, settlement.refunded)
			if tc.status != http.StatusOK {
				require.NotNil(t, apiErr)
				assert.Equal(t, tc.status, apiErr.StatusCode)
				return
			}
			require.Nil(t, apiErr)
			assert.Equal(t, tc.status, recorder.Code)
			assert.Equal(t, tc.response, recorder.Body.String())
		})
	}
}
