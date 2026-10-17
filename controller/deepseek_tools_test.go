package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDeepSeekToolsRoutesPricingAndRefunds(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	previousRetries := common.RetryTimes
	common.RetryTimes = 0
	t.Cleanup(func() { common.RetryTimes = previousRetries })
	user := &model.User{Id: 990045, Username: "tools-user", Quota: 1000000, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, db.Create(user).Error)
	token := seedToken(t, db, user.Id, "tools-token", "toolstestsecret")
	require.NoError(t, db.Model(token).Updates(map[string]any{"unlimited_quota": false, "remain_quota": 1000000}).Error)
	for _, name := range []string{"deepseek-search", "deepseek-fetch"} {
		require.NoError(t, db.Create(&model.ModelPricing{ModelName: name, BillingType: model.ModelPricingBillingRequest, RequestPrice: 0.00075, Enabled: true}).Error)
	}
	model.InvalidateModelPricingCache()
	upstreamCalls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls++
		if r.Header.Get("Authorization") != "Bearer provider-secret" {
			t.Error("incorrect provider authorization")
		}
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(string(body), `"fail"`):
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"error":{"type":"invalid_request_error","message":"rejected"}}`)
		case strings.Contains(string(body), `"empty"`):
			_, _ = io.WriteString(w, `{"results":[],"content":""}`)
		case r.URL.Path == "/v1/tools/search":
			if !strings.Contains(string(body), `"unknown_field":42`) {
				t.Error("unknown field was lost")
			}
			_, _ = io.WriteString(w, `{"results":[{"url":"https://example.org"}]}`)
		case r.URL.Path == "/v1/tools/fetch":
			_, _ = io.WriteString(w, `{"content":"page text"}`)
		default:
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
	}))
	defer upstream.Close()
	channel := &model.Channel{Name: "deepseek-tools", Type: constant.ChannelTypeDeepSeek, Key: "provider-secret", BaseURL: &upstream.URL, Models: "deepseek-search,deepseek-fetch", Group: "default", Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	engine := gin.New()
	engine.Use(func(c *gin.Context) { defer common.CleanupBodyStorage(c); c.Next() })
	engine.POST("/v1/tools/:tool", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) { Relay(c, types.RelayFormatDeepSeekTools) })
	spent := 0
	for _, tc := range []struct {
		path, body string
		status     int
		charged    bool
	}{
		{"search", `{"query":"test","model":"must-not-control-routing","unknown_field":42}`, 200, true},
		{"fetch", `{"url":"https://example.org"}`, 200, true},
		{"search", `{"query":"empty"}`, 200, false},
		{"fetch", `{"url":"empty"}`, 200, false},
		{"search", `{"query":"fail"}`, 400, false},
	} {
		request := httptest.NewRequest(http.MethodPost, "/v1/tools/"+tc.path, strings.NewReader(tc.body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer sk-"+token.Key)
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)
		require.Equal(t, tc.status, recorder.Code, recorder.Body.String())
		if tc.charged {
			spent += int(0.00075 * common.QuotaPerUnit)
		}
		var refreshedUser model.User
		var refreshedToken model.Token
		// Refund follows the existing asynchronous billing path.
		require.Eventually(t, func() bool {
			return db.First(&refreshedUser, user.Id).Error == nil && db.First(&refreshedToken, token.Id).Error == nil && refreshedUser.Quota == 1000000-spent && refreshedToken.RemainQuota == 1000000-spent
		}, 3*time.Second, 10*time.Millisecond)
		require.NoError(t, db.First(&refreshedUser, user.Id).Error)
		require.NoError(t, db.First(&refreshedToken, token.Id).Error)
		require.Equal(t, 1000000-spent, refreshedUser.Quota)
		require.Equal(t, 1000000-spent, refreshedToken.RemainQuota)
	}
	require.Equal(t, 5, upstreamCalls)
}
