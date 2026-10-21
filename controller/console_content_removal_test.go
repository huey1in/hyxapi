package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestStatusAndOptionsOmitRetiredConsoleContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	retired := []string{
		"ApiInfo", "FAQ", "console_setting.api_info", "console_setting.faq",
		"console_setting.api_info_enabled", "console_setting.faq_enabled",
	}
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{"Notice": "keep the site notice"}
	for _, key := range retired {
		common.OptionMap[key] = "obsolete content"
	}
	common.OptionMapRWMutex.Unlock()
	settings := console_setting.GetConsoleSetting()
	previousConsole := *settings
	settings.AnnouncementsEnabled = true
	settings.Announcements = `[{"content":"keep the announcement","publishDate":"2026-01-01T00:00:00Z"}]`
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		*settings = previousConsole
	})

	router := gin.New()
	router.GET("/api/status", GetStatus)
	router.GET("/api/option/", GetOptions)
	request := func(path string, result any) {
		t.Helper()
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		require.Equal(t, http.StatusOK, recorder.Code)
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), result))
	}
	var status struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	request("/api/status", &status)
	require.True(t, status.Success)
	for _, key := range []string{"api_info", "faq", "api_info_enabled", "faq_enabled"} {
		require.NotContains(t, status.Data, key)
	}
	require.Equal(t, true, status.Data["announcements_enabled"])
	require.Equal(t, "keep the announcement", status.Data["announcements"].([]any)[0].(map[string]any)["content"])

	var options struct {
		Success bool           `json:"success"`
		Data    []model.Option `json:"data"`
	}
	request("/api/option/", &options)
	require.True(t, options.Success)
	values := make(map[string]string, len(options.Data))
	for _, option := range options.Data {
		values[option.Key] = option.Value
	}
	exported := config.GlobalConfig.ExportAllConfigs()
	for _, key := range retired {
		require.NotContains(t, values, key)
		require.NotContains(t, exported, key)
	}
	require.Equal(t, "keep the site notice", values["Notice"])
}
