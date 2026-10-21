package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLogFeedHandlersKeepActorScopeRoleProjectionAndExportAllSources(t *testing.T) {
	user, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Task{}, &model.Midjourney{}))
	for _, id := range []int{user.Id, user.Id + 100} {
		require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: id, CreatedAt: 100, Content: "feed-log", UpstreamRequestId: "root-only", Other: `{"admin_info":{"request":"admin-only"},"root_info":{"key":"root-only"}}`}).Error)
		require.NoError(t, model.DB.Create(&model.Task{UserId: id, TaskID: "feed-task", SubmitTime: 100, Status: model.TaskStatusSuccess, PrivateData: model.TaskPrivateData{Key: "private-secret", UpstreamTaskID: "root-only"}}).Error)
		require.NoError(t, model.DB.Create(&model.Midjourney{UserId: id, MjId: "feed-mj", SubmitTime: 100900}).Error)
	}
	for _, all := range []bool{false, true} {
		for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleRootUser} {
			for _, export := range []bool{false, true} {
				response := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(response)
				c.Set("id", user.Id)
				c.Set("role", role)
				c.Request = httptest.NewRequest(http.MethodGet, "/api/log/feed?user_id=999&username=foreign&channel=999", nil)
				// All-scope filters are real filters, whereas self never trusts these.
				if all {
					c.Request = httptest.NewRequest(http.MethodGet, "/api/log/feed", nil)
				}
				if export {
					exportLogFeed(c, all)
				} else {
					getLogFeed(c, all)
				}
				if all && role < common.RoleAdminUser {
					require.Equal(t, http.StatusForbidden, response.Code)
					continue
				}
				require.Equal(t, http.StatusOK, response.Code)
				body := response.Body.String()
				require.NotContains(t, body, "private-secret")
				require.Equal(t, all && role >= common.RoleRootUser, strings.Contains(body, "root-only"))
				require.Equal(t, all && role >= common.RoleAdminUser, strings.Contains(body, "admin-only"))
				total := 3
				if all {
					total = 6
				}
				if export {
					lines := strings.Split(strings.TrimSpace(body), "\n")
					require.Len(t, lines, total+1)
					require.Contains(t, lines[len(lines)-1], `"success":true`)
				} else {
					var data struct {
						Success bool `json:"success"`
						Data    struct {
							Items []logFeedItem `json:"items"`
							Total int           `json:"total"`
						} `json:"data"`
					}
					require.NoError(t, json.Unmarshal(response.Body.Bytes(), &data))
					require.True(t, data.Success, body)
					require.Equal(t, total, data.Data.Total)
					require.Len(t, data.Data.Items, total)
				}
			}
		}
	}
}

func TestLogFeedRejectsMalformedFiltersBeforeQuerying(t *testing.T) {
	for _, query := range []string{"source=other", "sources=tasks,other", "sources=usage,usage", "start_timestamp=bad", "start_timestamp=2&end_timestamp=1", "end_timestamp=-1", "type=9", "channel=-1", "size=0", "cursor=bad"} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Set("id", 1)
		c.Set("role", common.RoleRootUser)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/log/feed?"+query, nil)
		GetLogFeed(c)
		require.Contains(t, response.Body.String(), `"success":false`, query)
	}
}
