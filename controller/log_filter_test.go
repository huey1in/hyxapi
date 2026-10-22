package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLogGroupFiltersKeepUserScopeAcrossChannels(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Task{}, &model.Midjourney{}))
	require.NoError(t, model.LOG_DB.Create(&[]model.Log{
		{UserId: user.Id, CreatedAt: 100, Type: model.LogTypeConsume, Group: "vip", ChannelId: 1, RequestId: "own-vip-first", Quota: 5, PromptTokens: 3, CompletionTokens: 7},
		{UserId: user.Id, CreatedAt: 100, Type: model.LogTypeConsume, Group: "vip", ChannelId: 2, RequestId: "own-vip-second", Quota: 7, PromptTokens: 11, CompletionTokens: 13},
		{UserId: user.Id, CreatedAt: 100, Type: model.LogTypeConsume, Group: "default", ChannelId: 1, RequestId: "other-group", Quota: 999},
		{UserId: user.Id + 100, CreatedAt: 100, Type: model.LogTypeConsume, Group: "vip", ChannelId: 1, RequestId: "foreign-vip", Quota: 17, PromptTokens: 41},
	}).Error)
	call := func(t *testing.T, handler gin.HandlerFunc, channel string) *httptest.ResponseRecorder {
		t.Helper()
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", user.Id)
		c.Set("role", common.RoleRootUser)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/log?group=vip"+channel, nil)
		handler(c)
		require.Equal(t, http.StatusOK, response.Code)
		return response
	}
	for _, channel := range []string{"", "&channel=1", "&channel=-1", "&channel=invalid"} {
		t.Run("obsolete-channel="+channel, func(t *testing.T) {
			for _, test := range []struct {
				name       string
				handler    gin.HandlerFunc
				all        bool
				countField string
			}{
				{"feed", GetLogFeed, true, "total"},
				{"self-feed", GetUserLogFeed, false, "total"},
				{"feed-export", ExportLogFeed, true, "count"},
				{"self-feed-export", ExportUserLogFeed, false, "count"},
				{"list", GetAllLogs, true, "total"},
				{"self-list", GetUserLogs, false, "total"},
				{"export", ExportAllLogs, true, "count"},
				{"self-export", ExportUserLogs, false, "count"},
			} {
				t.Run(test.name, func(t *testing.T) {
					body := call(t, test.handler, channel).Body.String()
					require.Contains(t, body, `"success":true`)
					require.Contains(t, body, "own-vip-first")
					require.Contains(t, body, "own-vip-second")
					require.NotContains(t, body, "other-group")
					count := 2
					if test.all {
						count++
						require.Contains(t, body, "foreign-vip")
					} else {
						require.NotContains(t, body, "foreign-vip")
					}
					require.Contains(t, body, fmt.Sprintf(`"%s":%d`, test.countField, count))
				})
			}
			for _, test := range []struct {
				name    string
				handler gin.HandlerFunc
				want    model.Stat
			}{
				{"stat", GetLogsStat, model.Stat{Quota: 29, Tokens: 75, Requests: 3}},
				{"self-stat", GetLogsSelfStat, model.Stat{Quota: 12, Tokens: 34, Requests: 2}},
			} {
				t.Run(test.name, func(t *testing.T) {
					var result struct {
						Success bool
						Data    model.Stat
					}
					require.NoError(t, json.Unmarshal(call(t, test.handler, channel).Body.Bytes(), &result))
					require.True(t, result.Success)
					require.Equal(t, test.want, result.Data)
				})
			}
		})
	}
}
