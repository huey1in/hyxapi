package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPerformanceAPIOnlyPublishesActiveGroupAggregates(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
	previous := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() { _ = ratio_setting.UpdateGroupRatioByJSONString(previous) })
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"visible":1}`))
	for _, metric := range []model.PerfMetric{
		{ModelName: "perf-api-test", Group: "visible", BucketTs: time.Now().Truncate(time.Hour).Unix(), RequestCount: 2, SuccessCount: 1, TotalLatencyMs: 2000, OutputTokens: 10, GenerationMs: 500},
		{ModelName: "perf-api-test", Group: "removed-private-group", BucketTs: time.Now().Truncate(time.Hour).Unix(), RequestCount: 100, SuccessCount: 100, TotalLatencyMs: 100000},
	} {
		require.NoError(t, model.UpsertPerfMetric(&metric))
	}
	for _, handler := range []gin.HandlerFunc{GetPerfMetrics, GetPerfMetricsSummary} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/?model=perf-api-test", nil)
		handler(c)
		require.Equal(t, http.StatusOK, recorder.Code)
		var result struct {
			Success bool `json:"success"`
			Data    struct {
				Summary struct {
					SuccessRate float64 `json:"success_rate"`
					AvgTPS      float64 `json:"avg_tps"`
				} `json:"summary"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &result))
		require.True(t, result.Success)
		require.Equal(t, 50.0, result.Data.Summary.SuccessRate)
		require.Equal(t, 20.0, result.Data.Summary.AvgTPS)
		for _, private := range []string{"removed-private-group", "request_count", "success_count", "channel_id", "api_key"} {
			require.NotContains(t, recorder.Body.String(), private)
		}
	}
}

func TestPerformanceAPIRejectsMissingModelAndOversizedHistory(t *testing.T) {
	for _, tc := range []struct {
		handler gin.HandlerFunc
		query   string
	}{
		{GetPerfMetrics, ""},
		{GetPerfMetricsSummary, "?" + strings.Repeat("recent_model="+url.QueryEscape("model")+"&", 51)},
	} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/"+tc.query, nil)
		tc.handler(c)
		require.Equal(t, http.StatusBadRequest, recorder.Code)
	}
}
