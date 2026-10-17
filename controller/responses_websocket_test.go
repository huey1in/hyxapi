package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRelayIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogs := model.DB, model.LOG_DB
	previousMemory, previousRedis := common.MemoryCacheEnabled, common.RedisEnabled
	previousLimit := setting.ModelRequestRateLimitEnabled
	previousPath, previousMaster := common.SQLitePath, common.IsMasterNode
	t.Setenv("SQL_DSN", "local")
	t.Setenv("LOG_SQL_DSN", "")
	common.SQLitePath, common.IsMasterNode = filepath.Join(t.TempDir(), "websocket.db"), false
	require.NoError(t, model.InitDB())
	require.NoError(t, model.InitLogDB())
	db := model.DB
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	common.MemoryCacheEnabled, common.RedisEnabled, setting.ModelRequestRateLimitEnabled = false, false, false
	t.Cleanup(func() {
		common.SQLitePath, common.IsMasterNode = previousPath, previousMaster
		model.DB, model.LOG_DB = previousDB, previousLogs
		common.MemoryCacheEnabled, common.RedisEnabled, setting.ModelRequestRateLimitEnabled = previousMemory, previousRedis, previousLimit
		model.InvalidateModelPricingCache()
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&model.Token{}, &model.User{}, &model.Channel{}, &model.Ability{}, &model.ModelPricing{}, &model.UserSubscription{}, &model.SubscriptionPlan{}, &model.SubscriptionPreConsumeRecord{}, &model.Log{}))
	return db
}

func TestResponsesWebSocketReauthenticatesAndBillsEachGeneration(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	user := &model.User{Id: 990021, Username: "ws-user", Quota: 1000000, Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, db.Create(user).Error)
	token := seedToken(t, db, user.Id, "ws-token", "wstestsecret")
	require.NoError(t, db.Model(token).Updates(map[string]any{"unlimited_quota": false, "remain_quota": 1000000}).Error)
	require.NoError(t, db.Create(&model.ModelPricing{ModelName: "ws-model", BillingType: model.ModelPricingBillingRequest, RequestPrice: 0.002, Enabled: true}).Error)
	model.InvalidateModelPricingCache()
	var connections, generations atomic.Int32
	upgrader := websocket.Upgrader{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer provider-secret" {
			t.Error("wrong upstream authorization")
		}
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer ws.Close()
		connections.Add(1)
		for {
			var event map[string]any
			if ws.ReadJSON(&event) != nil {
				return
			}
			if event["type"] != "response.create" {
				continue
			}
			generation := generations.Add(1)
			id := fmt.Sprintf("resp_%d", generation)
			_ = ws.WriteJSON(map[string]any{"type": "response.created", "response": map[string]any{"id": id, "status": "in_progress"}})
			_ = ws.WriteJSON(map[string]any{"type": "response.completed", "response": map[string]any{"id": id, "status": "completed", "usage": map[string]any{"input_tokens": 10, "output_tokens": 2}}})
		}
	}))
	defer upstream.Close()
	channel := &model.Channel{Name: "native-ws", Type: constant.ChannelTypeOpenAI, Key: "provider-secret", BaseURL: &upstream.URL, Models: "ws-model", Group: "default", Status: common.ChannelStatusEnabled}
	settings := `{"responses_websocket_enabled":true}`
	channel.Setting = &settings
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	engine := gin.New()
	engine.GET("/v1/responses", middleware.TokenAuth(), ResponsesWebSocket)
	server := httptest.NewServer(engine)
	defer server.Close()
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/v1/responses", http.Header{"Authorization": {"Bearer sk-" + token.Key}})
	require.NoError(t, err)
	defer client.Close()
	require.NoError(t, client.SetReadDeadline(time.Now().Add(10*time.Second)))
	for generation := 1; generation <= 2; generation++ {
		request := map[string]any{"type": "response.create", "response": map[string]any{"model": "ws-model", "input": "hello"}}
		require.NoError(t, client.WriteJSON(request))
		for {
			var event map[string]any
			require.NoError(t, client.ReadJSON(&event))
			require.NotEqual(t, "error", event["type"], event)
			if event["type"] == "response.completed" {
				break
			}
		}
	}
	require.EqualValues(t, 1, connections.Load())
	require.EqualValues(t, 2, generations.Load())
	var refreshed model.User
	require.NoError(t, db.First(&refreshed, user.Id).Error)
	require.Equal(t, user.Quota-2000, refreshed.Quota)
	var refreshedToken model.Token
	require.NoError(t, db.First(&refreshedToken, token.Id).Error)
	require.Equal(t, 1000000-2000, refreshedToken.RemainQuota)
	// The existing socket must not keep using a credential disabled after its handshake.
	require.NoError(t, db.Model(token).Update("status", 2).Error)
	require.NoError(t, client.WriteJSON(map[string]any{"type": "response.create", "model": "ws-model", "input": "blocked"}))
	var rejected map[string]any
	require.NoError(t, client.ReadJSON(&rejected))
	require.Equal(t, "error", rejected["type"])
	require.EqualValues(t, http.StatusUnauthorized, rejected["status"])
	require.EqualValues(t, 2, generations.Load())
}
