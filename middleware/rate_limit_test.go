package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestFrontendFilesUseIndependentRateLimit(t *testing.T) {
	previousWebEnable, previousWebNum, previousWebDuration := common.GlobalWebRateLimitEnable, common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration
	previousStaticEnable, previousStaticNum, previousStaticDuration := common.GlobalStaticRateLimitEnable, common.GlobalStaticRateLimitNum, common.GlobalStaticRateLimitDuration
	previousRedis := common.RedisEnabled
	t.Cleanup(func() {
		common.GlobalWebRateLimitEnable, common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration = previousWebEnable, previousWebNum, previousWebDuration
		common.GlobalStaticRateLimitEnable, common.GlobalStaticRateLimitNum, common.GlobalStaticRateLimitDuration = previousStaticEnable, previousStaticNum, previousStaticDuration
		common.RedisEnabled = previousRedis
	})
	common.RedisEnabled = false
	common.GlobalWebRateLimitEnable, common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration = true, 2, 180
	common.GlobalStaticRateLimitNum, common.GlobalStaticRateLimitDuration = 2, 180
	directory := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(directory, "assets"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(directory, "assets", "app.js"), []byte("app"), 0o644))

	for _, enabled := range []bool{false, true} {
		t.Run(map[bool]string{false: "static unlimited", true: "static limited"}[enabled], func(t *testing.T) {
			common.GlobalStaticRateLimitEnable = enabled
			engine := gin.New()
			require.NoError(t, engine.SetTrustedProxies(nil))
			engine.NoRoute(GlobalWebRateLimit(static.LocalFile(directory, false)), func(c *gin.Context) { c.Status(http.StatusNoContent) })
			ip := "192.0.2.101:1234"
			if enabled {
				ip = "192.0.2.102:1234"
			}
			request := func(path string) int {
				recorder := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, path, nil)
				req.RemoteAddr = ip
				engine.ServeHTTP(recorder, req)
				return recorder.Code
			}
			require.Equal(t, http.StatusNoContent, request("/assets/app.js"))
			require.Equal(t, http.StatusNoContent, request("/assets/app.js"))
			want := http.StatusNoContent
			if enabled {
				want = http.StatusTooManyRequests
			}
			require.Equal(t, want, request("/assets/app.js"))
			require.Equal(t, http.StatusNoContent, request("/console"))
			require.Equal(t, http.StatusNoContent, request("/assets/missing.js"))
			require.Equal(t, http.StatusTooManyRequests, request("/auth"))
		})
	}
}
