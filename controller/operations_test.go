package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

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
