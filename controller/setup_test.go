package controller

import (
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSetupAutoDetectsServerAddress(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name, requestURL, browserAddress, expected string
	}{
		{"proxy HTTPS origin", "http://127.0.0.1:3000/api/setup", "https://PUBLIC.example:443/", "https://public.example"},
		{"custom port", "http://127.0.0.1:3000/api/setup", "https://public.example:8443", "https://public.example:8443"},
		{"local IPv6", "http://127.0.0.1:3000/api/setup", "http://[::1]:3000", "http://[::1]:3000"},
		{"legacy direct HTTP", "http://localhost:3000/api/setup", "", "http://localhost:3000"},
		{"legacy direct HTTPS", "https://public.example/api/setup", "", "https://public.example"},
		{"invalid origin", "http://localhost:3000/api/setup", "https://public.example/setup?key=value", ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, err)
			pool, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { pool.Close() })
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.Setup{}, &model.Option{}))
			previousDB, previousSetup := model.DB, constant.Setup
			previousAddress := system_setting.ServerAddress
			previousSelf, previousDemo := operation_setting.SelfUseModeEnabled, operation_setting.DemoSiteEnabled
			common.OptionMapRWMutex.Lock()
			previousOptions := common.OptionMap
			common.OptionMap = maps.Clone(previousOptions)
			if common.OptionMap == nil {
				common.OptionMap = make(map[string]string)
			}
			common.OptionMapRWMutex.Unlock()
			model.DB, constant.Setup = db, false
			t.Cleanup(func() {
				model.DB, constant.Setup = previousDB, previousSetup
				system_setting.ServerAddress = previousAddress
				operation_setting.SelfUseModeEnabled, operation_setting.DemoSiteEnabled = previousSelf, previousDemo
				common.OptionMapRWMutex.Lock()
				common.OptionMap = previousOptions
				common.OptionMapRWMutex.Unlock()
			})
			router := gin.New()
			router.POST("/api/setup", PostSetup)
			payload, err := json.Marshal(SetupRequest{Username: "root", Password: "password123", ConfirmPassword: "password123", ServerAddress: test.browserAddress})
			require.NoError(t, err)
			request := httptest.NewRequest(http.MethodPost, test.requestURL, strings.NewReader(string(payload)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Forwarded-Host", "untrusted.example")
			request.Header.Set("X-Forwarded-Proto", "https")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			var result struct{ Success bool }
			require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
			if test.expected == "" {
				require.False(t, result.Success)
				require.False(t, constant.Setup)
				for _, row := range []any{&model.User{}, &model.Setup{}, &model.Option{}} {
					var count int64
					require.NoError(t, db.Model(row).Count(&count).Error)
					require.Zero(t, count)
				}
				require.Equal(t, previousAddress, system_setting.ServerAddress)
				return
			}
			require.True(t, result.Success, response.Body.String())
			require.True(t, constant.Setup)
			var address model.Option
			require.NoError(t, db.Where(&model.Option{Key: "ServerAddress"}).First(&address).Error)
			require.Equal(t, test.expected, address.Value)
			require.Equal(t, test.expected, system_setting.ServerAddress)
			// Completing setup a second time must not replace the saved address.
			retry := httptest.NewRequest(http.MethodPost, test.requestURL, strings.NewReader(`{"server_address":"https://another.example"}`))
			retry.Header.Set("Content-Type", "application/json")
			response = httptest.NewRecorder()
			router.ServeHTTP(response, retry)
			require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
			require.False(t, result.Success)
			require.Equal(t, test.expected, system_setting.ServerAddress)
		})
	}
}
