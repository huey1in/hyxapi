package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestOperationsReportKeepsAllTimeCountersIndependentOfPeriod(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}))
	now := time.Now().Unix()
	require.NoError(t, db.Create(&[]model.Log{
		{CreatedAt: now - 10*86400, Type: model.LogTypeConsume, UserId: 1, ChannelId: 1, Group: "default", Quota: 600, PromptTokens: 700, CompletionTokens: 200},
		{CreatedAt: now - 60, Type: model.LogTypeConsume, UserId: 1, ChannelId: 1, Group: "default", Quota: 401, PromptTokens: 300, CompletionTokens: 100},
		{CreatedAt: now - 30, Type: model.LogTypeError, UserId: 1, ChannelId: 1, Group: "default", Quota: 9999, PromptTokens: 9999},
	}).Error)
	for _, period := range []struct {
		name  string
		start int64
		end   int64
		usage model.Stat
	}{
		{"recent", now - 3600, now, model.Stat{Quota: 401, Tokens: 400, Requests: 1}},
		{"all_time", 0, 0, model.Stat{Quota: 1001, Tokens: 1300, Requests: 2}},
		{"no_usage", now + 1, now + 60, model.Stat{}},
	} {
		t.Run(period.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/operations/enhanced?start_timestamp=%d&end_timestamp=%d", period.start, period.end), nil)
			GetEnhancedOperations(ctx)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					Summary struct {
						Consumption struct {
							Range   model.Stat `json:"range"`
							AllTime model.Stat `json:"all_time"`
						} `json:"consumption"`
					} `json:"summary"`
				} `json:"data"`
			}
			require.Equal(t, http.StatusOK, recorder.Code)
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.True(t, response.Success, recorder.Body.String())
			require.Equal(t, period.usage, response.Data.Summary.Consumption.Range)
			require.Equal(t, model.Stat{Quota: 1001, Tokens: 1300, Requests: 2}, response.Data.Summary.Consumption.AllTime)
		})
	}
}

func TestOperationsReportDoesNotPublishZeroTotalsWhenDatabaseQueryFails(t *testing.T) {
	for _, table := range []string{"top_ups", "logs", "users"} {
		t.Run(table, func(t *testing.T) {
			db := setupRelayIntegrationDB(t)
			require.NoError(t, db.AutoMigrate(&model.TopUp{}))
			// Raw aggregations use Row, while model counts and channel names use Query.
			fail := func(tx *gorm.DB) {
				if tx.Statement.Table == table {
					tx.AddError(errors.New("private database failure"))
				}
			}
			require.NoError(t, db.Callback().Row().Before("gorm:row").Register("operations_read_failure", fail))
			require.NoError(t, db.Callback().Query().Before("gorm:query").Register("operations_read_failure", fail))
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/operations/enhanced", nil)
			GetEnhancedOperations(ctx)
			var response struct {
				Success bool `json:"success"`
				Data    any  `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.False(t, response.Success, recorder.Body.String())
			require.Nil(t, response.Data)
			require.NotContains(t, recorder.Body.String(), "private database failure")
		})
	}
}
