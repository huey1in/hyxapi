package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSystemStatusKeepsRequestHealthWithoutChannelInventory(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	now := time.Now().Unix()
	require.NoError(t, db.Create(&[]model.Log{
		{CreatedAt: now, Type: model.LogTypeConsume, ChannelId: 1, ModelName: "status-model", Quota: 25, PromptTokens: 10, CompletionTokens: 3, UseTime: 2},
		{CreatedAt: now, Type: model.LogTypeError, ChannelId: 1, ModelName: "status-model", UseTime: 5},
	}).Error)
	channelReads := 0
	rejectChannelRead := func(tx *gorm.DB) {
		if tx.Statement.Table == "channels" {
			channelReads++
			tx.AddError(errors.New("channel inventory unavailable"))
		}
	}
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("reject_status_channel_inventory", rejectChannelRead))
	require.NoError(t, db.Callback().Row().Before("gorm:row").Register("reject_status_channel_inventory", rejectChannelRead))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/system-status", nil)
	GetSystemStatus(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool                       `json:"success"`
		Data    map[string]json.RawMessage `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Zero(t, channelReads, "system status must not fetch the channel inventory")
	for _, key := range []string{"risk", "channels", "models"} {
		require.NotContains(t, response.Data, key)
	}
	var requestHealth model.RequestHealthStat
	require.NoError(t, json.Unmarshal(response.Data["request_health"], &requestHealth))
	require.EqualValues(t, 2, requestHealth.TotalRequests)
	require.EqualValues(t, 1, requestHealth.SuccessRequests)
	require.EqualValues(t, 1, requestHealth.ErrorRequests)
	require.Equal(t, float64(50), requestHealth.SuccessRate)
	require.Equal(t, float64(2), requestHealth.AvgLatencySeconds)
	var stats struct {
		Requests int `json:"today_requests"`
		Tokens   int `json:"today_tokens"`
		Quota    int `json:"today_quota"`
	}
	require.NoError(t, json.Unmarshal(response.Data["request_stats"], &stats))
	require.Equal(t, 1, stats.Requests)
	require.Equal(t, 13, stats.Tokens)
	require.Equal(t, 25, stats.Quota)
}
