package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/log_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestLogTimeRangeDefaultsBoundsAndInvalidOrder(t *testing.T) {
	setting := log_setting.GetSetting()
	old := setting.MaxRangeDays
	setting.MaxRangeDays = 7
	t.Cleanup(func() { setting.MaxRangeDays = old })
	end := time.Now().Unix() - 100
	start, err := limitLogTimeRange(0, end)
	require.NoError(t, err)
	require.Equal(t, end-7*86400, start)
	_, err = limitLogTimeRange(end-7*86400, end)
	require.NoError(t, err)
	_, err = limitLogTimeRange(end-7*86400-1, end)
	require.Error(t, err)
	_, err = limitLogTimeRange(end+1, end)
	require.Error(t, err)
	_, err = limitLogTimeRange(-1, end)
	require.Error(t, err)
	_, err = limitLogTimeRange(time.Now().Unix()+86400, time.Now().Unix()+2*86400)
	require.Error(t, err)
}

func TestLogExportProjectsAdministratorAndRootDiagnostics(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: user.Id, CreatedAt: time.Now().Unix(), Type: model.LogTypeConsume, RequestId: "public-request", UpstreamRequestId: "provider-private", Other: `{"cache_tokens":3,"admin_info":{"channel":"admin-value"},"root_info":{"key":"root-value"}}`}).Error)
	for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleRootUser} {
		t.Run(fmt.Sprint(role), func(t *testing.T) {
			response := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(response)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/log/export", nil)
			c.Set("id", user.Id)
			c.Set("role", role)
			ExportAllLogs(c)
			require.Equal(t, http.StatusOK, response.Code)
			lines := strings.Split(strings.TrimSpace(response.Body.String()), "\n")
			require.Len(t, lines, 2)
			var entry model.Log
			require.NoError(t, json.Unmarshal([]byte(lines[0]), &entry))
			require.Equal(t, "public-request", entry.RequestId)
			require.Equal(t, role >= common.RoleRootUser, strings.Contains(entry.Other, "root-value"))
			require.Equal(t, role >= common.RoleAdminUser, strings.Contains(entry.Other, "admin-value"))
			require.Equal(t, role >= common.RoleRootUser, entry.UpstreamRequestId != "")
		})
	}
}

func TestLogStatPublishesLiveRatesAndKeepsRenamedUserHistoryPrivate(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	now := time.Now().Unix()
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: user.Id, Username: "old-name", CreatedAt: now - 3600, Type: model.LogTypeConsume, ModelName: "rate-test", Quota: 9, PromptTokens: 100, CompletionTokens: 200},
		{UserId: user.Id, Username: user.Username, CreatedAt: now - 10, Type: model.LogTypeConsume, ModelName: "rate-test", Quota: 5, PromptTokens: 3, CompletionTokens: 7},
		{UserId: user.Id + 100, Username: user.Username, CreatedAt: now - 10, Type: model.LogTypeConsume, ModelName: "rate-test", Quota: 999, PromptTokens: 999},
	}).Error)
	for _, self := range []bool{true, false} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", user.Id)
		c.Set("username", user.Username)
		c.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/log/stat?start_timestamp=%d&end_timestamp=%d&model_name=rate-test", now-3700, now-3500), nil)
		if self {
			GetLogsSelfStat(c)
		} else {
			GetLogsStat(c)
		}
		require.Equal(t, http.StatusOK, response.Code)
		var result struct {
			Success bool       `json:"success"`
			Data    model.Stat `json:"data"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success)
		require.Equal(t, 9, result.Data.Quota)
		require.EqualValues(t, 300, result.Data.Tokens)
		require.Equal(t, 1, result.Data.Requests)
		if self {
			require.Equal(t, 1, result.Data.Rpm)
			require.EqualValues(t, 10, result.Data.Tpm)
		} else {
			require.Equal(t, 2, result.Data.Rpm)
			require.EqualValues(t, 1009, result.Data.Tpm)
		}
	}
}
