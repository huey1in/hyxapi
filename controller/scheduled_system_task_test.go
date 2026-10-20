package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestManualScheduledJobsEnqueuePayloadAndRejectDuplicate(t *testing.T) {
	for _, tc := range []struct {
		name     string
		taskType string
		handler  gin.HandlerFunc
		payload  map[string]any
	}{
		{"channel test", model.SystemTaskTypeChannelTest, TestAllChannels, map[string]any{"mode": "scheduled_all", "notify": true}},
		{"model detection", model.SystemTaskTypeModelUpdate, DetectAllChannelUpstreamModelUpdates, map[string]any{"manual": true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			previousDB, previousLogDB, previousRedis := model.DB, model.LOG_DB, common.RedisEnabled
			model.DB = db
			model.LOG_DB = db
			common.RedisEnabled = false
			t.Cleanup(func() {
				model.DB, model.LOG_DB, common.RedisEnabled = previousDB, previousLogDB, previousRedis
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}, &model.User{}, &model.Log{}))
			user := &model.User{Username: "scheduler-test", Password: "unused", Role: common.RoleRootUser}
			require.NoError(t, db.Create(user).Error)

			invoke := func() *httptest.ResponseRecorder {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)
				ctx.Set("id", user.Id)
				ctx.Set("role", common.RoleRootUser)
				tc.handler(ctx)
				return recorder
			}
			first := invoke()
			require.Equal(t, http.StatusOK, first.Code)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					TaskID string `json:"task_id"`
				} `json:"data"`
			}
			require.NoError(t, common.Unmarshal(first.Body.Bytes(), &response))
			require.True(t, response.Success)
			task, err := model.GetSystemTaskByTaskID(response.Data.TaskID)
			require.NoError(t, err)
			require.NotNil(t, task)
			require.Equal(t, tc.taskType, task.Type)
			var payload map[string]any
			require.NoError(t, task.DecodePayload(&payload))
			require.Equal(t, tc.payload, payload)
			duplicate := invoke()
			require.Equal(t, http.StatusConflict, duplicate.Code)
			require.Contains(t, duplicate.Body.String(), task.TaskID)
			var count int64
			require.NoError(t, db.Model(&model.SystemTask{}).Count(&count).Error)
			require.EqualValues(t, 1, count)
		})
	}
}
