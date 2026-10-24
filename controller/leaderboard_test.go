package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLeaderboardRequiresAuthenticationAndRejectsIdentityProbes(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	router := gin.New()
	router.GET("/api/leaderboard", middleware.DisableCache(), middleware.UserAuth(), GetLeaderboard)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/leaderboard", nil))
	require.Equal(t, http.StatusUnauthorized, response.Code)
	credential, _ := createScopedAccessToken(t, user.Id, time.Now().Add(time.Hour).Unix(), "usage:read")
	response = accessTokenRequest(router, http.MethodGet, "/api/leaderboard", credential, "", "")
	require.Equal(t, http.StatusForbidden, response.Code)
	require.Contains(t, response.Header().Get("Cache-Control"), "no-store")
	for _, query := range []string{
		"period=custom", "metric=quota", "user_id=42", "username=someone", "email=secret%40example.com",
		"start_timestamp=100", "period=week&period=today", "metric=tokens&metric=requests",
	} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", 1)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/leaderboard?"+query, nil)
		GetLeaderboard(c)
		require.Equal(t, http.StatusBadRequest, response.Code, query)
		require.NotContains(t, response.Body.String(), "example.com")
	}
}

func TestLeaderboardResponseKeepsPrivateFieldsAndViewerDataSeparated(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	groups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
	model.InvalidatePricingCache()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(groups))
		model.InvalidatePricingCache()
	})
	for _, user := range []model.User{
		{Id: 871, Username: "leader-alice", AffCode: "leader-alice", Group: "default", Role: common.RoleCommonUser, Status: 1, Email: "private-alice@example.com", Password: "private-password"},
		{Id: 872, Username: "leader-bob", AffCode: "leader-bob", Group: "vip_only", Role: common.RoleCommonUser, Status: 1, Email: "private-bob@example.com"},
	} {
		require.NoError(t, db.Create(&user).Error)
	}
	require.NoError(t, db.Create(&model.Channel{Id: 1, Type: 1, Status: 1}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{ChannelId: 1, Group: "default", Model: "leader-public", Enabled: true},
		{ChannelId: 1, Group: "vip_only", Model: "leader-private", Enabled: true},
	}).Error)
	for _, name := range []string{"leader-public", "leader-private"} {
		require.NoError(t, model.SaveModelPricing(&model.ModelPricing{ModelName: name, Enabled: true, InputPrice: 1}))
	}
	require.NoError(t, db.Create(&[]model.Log{
		{UserId: 871, CreatedAt: time.Now().Unix(), Type: model.LogTypeConsume, ModelName: "leader-public", PromptTokens: 100, Content: "private-prompt", Ip: "192.0.2.33", TokenName: "private-key", Other: "private-other"},
		{UserId: 871, CreatedAt: time.Now().Unix(), Type: model.LogTypeConsume, ModelName: "leader-private", PromptTokens: 300},
		{UserId: 872, CreatedAt: time.Now().Unix(), Type: model.LogTypeConsume, ModelName: "leader-public", PromptTokens: 200},
	}).Error)
	model.InvalidatePricingCache()
	for index, viewerID := range []int{871, 872} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", viewerID)
		path := "/api/leaderboard"
		if index > 0 {
			path += "?period=today&metric=tokens"
		}
		c.Request = httptest.NewRequest(http.MethodGet, path, nil)
		GetLeaderboard(c)
		require.Equal(t, http.StatusOK, response.Code)
		var envelope struct {
			Success bool                `json:"success"`
			Data    service.Leaderboard `json:"data"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &envelope))
		require.True(t, envelope.Success)
		require.Equal(t, "today", envelope.Data.Period)
		require.Equal(t, "tokens", envelope.Data.Metric)
		local := time.Now().In(time.FixedZone("Asia/Shanghai", 8*3600))
		start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
		require.Equal(t, start.Unix(), envelope.Data.StartAt)
		require.Len(t, envelope.Data.Users, 2)
		require.Equal(t, "leader-alice", envelope.Data.Users[0].Username)
		require.Equal(t, index+1, *envelope.Data.MyRank)
		require.True(t, envelope.Data.Users[index].IsMe)
		require.False(t, envelope.Data.Users[1-index].IsMe)
		for _, private := range []string{"example.com", "private-password", "private-prompt", "192.0.2.33", "private-key", "private-other", `"user_id"`, `"email"`, `"quota"`, `"id"`} {
			require.NotContains(t, response.Body.String(), private)
		}
		if index == 0 {
			require.NotContains(t, response.Body.String(), "leader-private")
		} else {
			require.Contains(t, response.Body.String(), "leader-private")
		}
	}
}
