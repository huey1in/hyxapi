package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestLogTimeRangeHasNoMaximumSpanAndRejectsInvalidDates(t *testing.T) {
	now := time.Now().Unix()
	for _, test := range []struct {
		name       string
		start, end int64
		valid      bool
	}{
		{"all history", 0, now - 100, true},
		{"open end", 0, 0, true},
		{"multiple years", now - 3*365*86400, now - 100, true},
		{"reversed", now, now - 100, false},
		{"negative start", -1, now, false},
		{"negative end", 0, -1, false},
		{"future start", now + 86400, now + 2*86400, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(response)
			start, end := test.start, test.end
			require.Equal(t, test.valid, applyLogRange(c, &start, &end))
			require.Equal(t, test.start, start, "the query must not truncate historical records")
			if test.valid {
				require.Positive(t, end)
				if test.end > 0 {
					require.Equal(t, test.end, end)
				}
			}
		})
	}
}

func TestLogQueriesAndExportsKeepHistoricalRecordsAndUserScope(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	old := time.Now().AddDate(-3, 0, 0).Unix()
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: user.Id, CreatedAt: old, Type: model.LogTypeConsume, RequestId: "own-historical"},
		{UserId: user.Id + 100, CreatedAt: old, Type: model.LogTypeConsume, RequestId: "foreign-historical"},
	}).Error)
	for _, span := range []string{"", fmt.Sprintf("?start_timestamp=%d&end_timestamp=%d", old-1, time.Now().Unix())} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", user.Id)
		c.Set("role", common.RoleCommonUser)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/log/self"+span, nil)
		GetUserLogs(c)
		require.Contains(t, response.Body.String(), "own-historical")
		require.NotContains(t, response.Body.String(), "foreign-historical")
		for _, all := range []bool{false, true} {
			response = httptest.NewRecorder()
			c, _ = gin.CreateTestContext(response)
			c.Set("id", user.Id)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/log/export"+span, nil)
			if all {
				c.Set("role", common.RoleAdminUser)
				ExportAllLogs(c)
			} else {
				c.Set("role", common.RoleCommonUser)
				ExportUserLogs(c)
			}
			require.Equal(t, http.StatusOK, response.Code)
			require.Contains(t, response.Body.String(), "own-historical")
			require.Equal(t, all, strings.Contains(response.Body.String(), "foreign-historical"))
			require.Contains(t, response.Body.String(), `"success":true`)
		}
	}
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

func TestDashboardUsageOmitsLiveRatesAndKeepsRenamedUserHistoryPrivate(t *testing.T) {
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
		c.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/log/stat?start_timestamp=%d&end_timestamp=%d&model_name=rate-test&include_rates=true", now-3700, now-3500), nil)
		if self {
			GetLogsSelfStat(c)
		} else {
			GetLogsStat(c)
		}
		require.Equal(t, http.StatusOK, response.Code)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				model.Stat
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success)
		require.NotContains(t, response.Body.String(), `"token_usage"`)
		require.Equal(t, 9, result.Data.Quota)
		require.EqualValues(t, 300, result.Data.Tokens)
		require.Equal(t, 1, result.Data.Requests)
		require.NotContains(t, response.Body.String(), `"rpm"`)
		require.NotContains(t, response.Body.String(), `"tpm"`)
	}
}

func TestLogUsageAndKeyChoicesAreScopedAndValidateFilters(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}))
	require.NoError(t, model.DB.Create(&[]model.Token{
		{Id: 201, UserId: user.Id, Name: "duplicate", Key: "private-current-key"},
		{Id: 206, UserId: user.Id, Name: "unused", Key: "private-unused-key"},
		{Id: 207, UserId: user.Id + 100, Name: "foreign-unused", Key: "private-foreign-key"},
	}).Error)
	now := time.Now().Unix()
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: user.Id, Username: "renamed-user", TokenId: 201, TokenName: "duplicate", CreatedAt: now - 100, Type: model.LogTypeConsume, Quota: 5, PromptTokens: 3, CompletionTokens: 7},
		{UserId: user.Id, TokenId: 202, TokenName: "duplicate", CreatedAt: now - 100, Type: model.LogTypeConsume, Quota: 17, PromptTokens: 41},
		{UserId: user.Id + 100, Username: user.Username, TokenId: 203, TokenName: "duplicate", CreatedAt: now - 100, Type: model.LogTypeConsume, Quota: 999, PromptTokens: 999},
		{UserId: user.Id, TokenId: 204, TokenName: "old", CreatedAt: now - 7200, Type: model.LogTypeConsume, Quota: 999},
		{UserId: user.Id, TokenId: 205, TokenName: "error-only", CreatedAt: now - 100, Type: model.LogTypeError, Quota: 999},
	}).Error)
	rangeQuery := fmt.Sprintf("start_timestamp=%d&end_timestamp=%d", now-3600, now)
	call := func(handler gin.HandlerFunc, actor int, query string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", actor)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/log/stat?"+query, nil)
		handler(c)
		return response
	}
	for _, test := range []struct {
		name                    string
		handler                 gin.HandlerFunc
		query                   string
		quota, tokens, requests int
	}{
		{"self", GetLogsSelfStat, rangeQuery, 22, 51, 2},
		{"self-key", GetLogsSelfStat, rangeQuery + "&token_id=201", 5, 10, 1},
		{"foreign-key", GetLogsSelfStat, rangeQuery + "&token_id=203&username=" + user.Username, 0, 0, 0},
		{"admin", GetLogsStat, rangeQuery, 1021, 1050, 3},
		{"admin-key", GetLogsStat, rangeQuery + "&token_id=203", 999, 999, 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := call(test.handler, user.Id, test.query)
			var result struct {
				Success bool
				Data    model.Stat
			}
			require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success)
			require.Equal(t, model.Stat{Quota: test.quota, Tokens: int64(test.tokens), Requests: test.requests}, result.Data)
			require.NotContains(t, response.Body.String(), `"rpm"`)
			require.NotContains(t, response.Body.String(), `"tpm"`)
		})
	}
	for _, self := range []bool{true, false} {
		handler := GetLogTokenOptions
		if self {
			handler = GetUserLogTokenOptions
		}
		response := call(handler, user.Id, rangeQuery)
		var result struct {
			Success bool
			Data    []model.LogTokenOption
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success)
		expected := []model.LogTokenOption{{ID: 206, Name: "unused"}, {ID: 202, Name: "duplicate"}, {ID: 201, Name: "duplicate"}}
		if !self {
			expected = []model.LogTokenOption{{ID: 207, Name: "foreign-unused"}, {ID: 206, Name: "unused"}, {ID: 203, Name: "duplicate"}, {ID: 202, Name: "duplicate"}, {ID: 201, Name: "duplicate"}}
		}
		require.Equal(t, expected, result.Data)
		require.NotContains(t, response.Body.String(), `"key"`)
	}
	for _, handler := range []gin.HandlerFunc{GetLogsStat, GetLogsSelfStat, GetLogTokenOptions, GetUserLogTokenOptions} {
		require.Equal(t, http.StatusUnauthorized, call(handler, 0, rangeQuery).Code)
		for _, query := range []string{"token_id=0", "token_id=-1", "token_id=invalid", "token_id=9999999999999999999999", "start_timestamp=invalid", "start_timestamp=-1", "end_timestamp=-1", "start_timestamp=100&end_timestamp=99", fmt.Sprintf("start_timestamp=%d", now+86400)} {
			response := call(handler, user.Id, query)
			require.Contains(t, response.Body.String(), `"success":false`, query)
		}
	}
}
