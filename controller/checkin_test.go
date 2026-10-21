package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetCheckinStatusReturnsCountsAndCalendarWithoutRewardSummaries(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "checkin.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.AutoMigrate(&model.Checkin{}))
	require.NoError(t, db.Create(&[]model.Checkin{
		{UserId: 41, CheckinDate: "2024-02-29", QuotaAwarded: 9},
		{UserId: 41, CheckinDate: "2024-03-01", QuotaAwarded: 11},
		{UserId: 42, CheckinDate: "2024-02-10", QuotaAwarded: 999},
	}).Error)

	setting := operation_setting.GetCheckinSetting()
	previousSetting := *setting
	*setting = operation_setting.CheckinSetting{Enabled: true, MinQuota: 9, MaxQuota: 11}
	t.Cleanup(func() { *setting = previousSetting })

	response := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(response)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/checkin?month=2024-02", nil)
	ctx.Set("id", 41)
	GetCheckinStatus(ctx)

	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.True(t, body.Success)
	require.Len(t, body.Data, 3)
	require.Equal(t, true, body.Data["enabled"])
	require.Regexp(t, `^\d{4}-\d{2}-\d{2}$`, body.Data["today"])
	require.NotContains(t, body.Data, "min_quota")
	require.NotContains(t, body.Data, "max_quota")
	stats, ok := body.Data["stats"].(map[string]any)
	require.True(t, ok)
	require.Len(t, stats, 4)
	require.EqualValues(t, 2, stats["total_checkins"])
	require.EqualValues(t, 1, stats["checkin_count"])
	require.Contains(t, stats, "checked_in_today")
	require.NotContains(t, stats, "total_quota")
	require.Equal(t, []any{map[string]any{"checkin_date": "2024-02-29", "quota_awarded": float64(9)}}, stats["records"])
}
