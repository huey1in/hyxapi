package controller

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPricingSyncDirectExportPreservesAllAbsoluteLanesAndCacheIsolation(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.Create(&model.ModelPricing{ModelName: "sync-direct-absolute", InputPrice: 0, OutputPrice: 4, CacheReadPrice: 0, CacheWritePrice: 2, ImagePrice: 3, AudioInputPrice: 5, AudioOutputPrice: 6, Enabled: true}).Error)
	before, err := getLocalPricingSyncData()
	require.NoError(t, err)
	expression := valueMap(before["billing_expr"])["sync-direct-absolute"].(string)
	for _, term := range []string{"p * 0", "c * 4", "cr * 0", "cc * 2", "cc1h * 2", "img * 3", "ai * 5", "ao * 6"} {
		require.Contains(t, expression, term)
	}
	require.NotContains(t, valueMap(before["model_ratio"]), "sync-direct-absolute")
	valueMap(before["model_ratio"])["not-a-global-price"] = float64(123)
	after, err := getLocalPricingSyncData()
	require.NoError(t, err)
	require.NotContains(t, valueMap(after["model_ratio"]), "not-a-global-price", "export must not mutate shared exposed maps")
	diff := buildDifferences(after, []struct {
		name string
		data map[string]any
	}{{"source", map[string]any{"model_ratio": map[string]float64{"sync-direct-absolute": 1}, "completion_ratio": map[string]float64{"sync-direct-absolute": 2}}}})
	require.Contains(t, diff["sync-direct-absolute"], "model_ratio", "simple USD schedules may explicitly switch to an upstream ratio")
}

func TestPricingSyncDirectExportDoesNotOverrideExplicitMode(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	before := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{"billing_mode": before["billing_setting.billing_mode"], "billing_expr": before["billing_setting.billing_expr"]})
	})
	require.NoError(t, db.Create(&model.ModelPricing{ModelName: "sync-direct-explicit", InputPrice: 8, Enabled: true}).Error)
	config.UpdateConfigFromMap(config.GlobalConfig.Get("billing_setting"), map[string]string{"billing_mode": `{"sync-direct-explicit":"tiered_expr"}`, "billing_expr": `{"sync-direct-explicit":"tier(\"configured\", p * 3)"}`})
	data, err := getLocalPricingSyncData()
	require.NoError(t, err)
	require.Equal(t, `tier("configured", p * 3)`, valueMap(data["billing_expr"])["sync-direct-explicit"])
	require.NotContains(t, valueMap(data["direct_models"]), "sync-direct-explicit")
}

func TestPricingSyncInvalidAndRedirectResponsesAreFailures(t *testing.T) {
	var redirected atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/redirect":
			http.Redirect(w, r, "/destination", http.StatusFound)
		case "/destination":
			redirected.Add(1)
			_, _ = io.WriteString(w, `{"success":true,"data":{"model_ratio":{"m":0}}}`)
		case "/oversized":
			_, _ = io.WriteString(w, strings.Repeat(" ", maxRatioConfigBytes+1))
		default:
			_, _ = io.WriteString(w, `{"success":false}`)
		}
	}))
	defer server.Close()
	for _, path := range []string{"/redirect", "/oversized", "/failed"} {
		t.Run(path, func(t *testing.T) {
			var response struct {
				Success bool
				Data    struct {
					TestResults []struct{ Status, Error string } `json:"test_results"`
				}
			}
			ratioSyncRequest(t, FetchUpstreamRatios, http.MethodPost, "/api/ratio_sync/fetch", gin.H{"upstreams": []gin.H{{"name": "source", "base_url": server.URL, "endpoint": path}}}, &response)
			require.True(t, response.Success)
			require.Len(t, response.Data.TestResults, 1)
			require.Equal(t, "error", response.Data.TestResults[0].Status)
			require.NotEmpty(t, response.Data.TestResults[0].Error)
		})
	}
	require.Zero(t, redirected.Load())
}

func TestPricingSyncRequestCancellationReachesUpstream(t *testing.T) {
	started, cancelled := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(started); <-r.Context().Done(); close(cancelled) }))
	defer server.Close()
	body, err := common.Marshal(gin.H{"upstreams": []gin.H{{"name": "source", "base_url": server.URL}}})
	require.NoError(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/api/ratio_sync/fetch", bytes.NewReader(body)).WithContext(ctx)
	done := make(chan struct{})
	go func() { FetchUpstreamRatios(c); close(done) }()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("fetch did not start")
	}
	cancel()
	select {
	case <-cancelled:
	case <-time.After(3 * time.Second):
		t.Fatal("provider request did not cancel")
	}
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("handler kept retrying after cancellation")
	}
}

func TestPricingSyncOpenRouterRejectsMalformedCosts(t *testing.T) {
	data, err := convertOpenRouterToRatioData(strings.NewReader(`{"data":[{"id":"invalid","pricing":{"prompt":"?","completion":"0"}},{"id":"overflow","pricing":{"prompt":"1e999","completion":"0"}},{"id":"free","pricing":{"prompt":"0","completion":"0"}},{"id":"paid","pricing":{"prompt":"0.000002","completion":"0.000008","input_cache_read":"0"}}]}`))
	require.NoError(t, err)
	require.Equal(t, map[string]any{"free": float64(0), "paid": float64(1)}, valueMap(data["model_ratio"]))
	require.Equal(t, float64(4), valueMap(data["completion_ratio"])["paid"])
	require.Equal(t, float64(0), valueMap(data["cache_ratio"])["paid"])
}

func TestRatioConfigDisabledReturnsForbidden(t *testing.T) {
	old := ratio_setting.IsExposeRatioEnabled()
	t.Cleanup(func() { ratio_setting.SetExposeRatioEnabled(old) })
	ratio_setting.SetExposeRatioEnabled(false)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/ratio_config", nil)
	GetRatioConfig(c)
	require.Equal(t, http.StatusForbidden, w.Code)
}
