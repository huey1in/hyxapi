package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLogUsageTrendSharesTotalsFiltersAndImmutableActorScope(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	location, err := time.LoadLocation("Asia/Shanghai")
	require.NoError(t, err)
	now := time.Now().In(location)
	start := time.Date(now.Year(), now.Month(), now.Day()-3, 0, 0, 0, 0, location)
	end := start.AddDate(0, 0, 3).Unix() - 1
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: user.Id, Username: "renamed", TokenId: 201, CreatedAt: start.Unix(), Type: model.LogTypeConsume, Quota: 5, PromptTokens: 3, CompletionTokens: 7},
		{UserId: user.Id, TokenId: 202, CreatedAt: end, Type: model.LogTypeConsume, Quota: 17, PromptTokens: 41},
		{UserId: user.Id + 100, Username: user.Username, TokenId: 203, CreatedAt: start.Unix(), Type: model.LogTypeConsume, Quota: 999, PromptTokens: 999},
		{UserId: user.Id, TokenId: 201, CreatedAt: start.Unix() - 1, Type: model.LogTypeConsume, Quota: 999},
		{UserId: user.Id, TokenId: 201, CreatedAt: end + 1, Type: model.LogTypeConsume, Quota: 999},
		{UserId: user.Id, TokenId: 201, CreatedAt: start.Unix(), Type: model.LogTypeError, Quota: 999},
	}).Error)
	for _, test := range []struct {
		name    string
		handler gin.HandlerFunc
		key     int
		quota   int
		first   int64
	}{
		{"self", GetLogsSelfStat, 0, 22, 5},
		{"self-key", GetLogsSelfStat, 201, 5, 5},
		{"foreign-key", GetLogsSelfStat, 203, 0, 0},
		{"admin", GetLogsStat, 0, 1021, 1004},
		{"admin-key", GetLogsStat, 203, 999, 999},
		{"unused-key", GetLogsSelfStat, 204, 0, 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(response)
			c.Set("id", user.Id)
			params := fmt.Sprintf("start_timestamp=%d&end_timestamp=%d&include_trend=true&timezone=Asia%%2FShanghai", start.Unix(), end)
			if test.key > 0 {
				params += fmt.Sprintf("&token_id=%d", test.key)
			}
			c.Request = httptest.NewRequest(http.MethodGet, "/api/log/stat?"+params, nil)
			test.handler(c)
			var result struct {
				Success bool
				Data    struct {
					model.Stat
					Trend model.LogUsageTrend
				}
			}
			require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success, response.Body.String())
			require.Equal(t, test.quota, result.Data.Quota)
			require.Equal(t, "day", result.Data.Trend.Interval)
			require.Len(t, result.Data.Trend.Points, 3)
			require.Equal(t, test.first, result.Data.Trend.Points[0].Quota)
			require.Zero(t, result.Data.Trend.Points[1].Quota)
			var sum int64
			for index, point := range result.Data.Trend.Points {
				require.Equal(t, start.AddDate(0, 0, index).Unix(), point.Timestamp)
				sum += point.Quota
			}
			require.EqualValues(t, result.Data.Quota, sum)
			require.NotContains(t, response.Body.String(), `"rpm"`)
		})
	}
}

func TestLogUsageTrendRejectsInvalidOptions(t *testing.T) {
	for _, query := range []string{"include_trend=invalid", "include_trend=true&timezone=not-a-timezone", "include_trend=true&timezone=Local", "include_trend=true&end_timestamp=9223372036854775808"} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", 1)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/log/self/stat?"+query, nil)
		GetLogsSelfStat(c)
		require.Contains(t, response.Body.String(), `"success":false`, query)
	}
}
