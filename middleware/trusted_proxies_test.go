package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTrustedProxyConfigurationMatchesAcrossEngines(t *testing.T) {
	for _, tc := range []struct{ name, configured, remote, expected string }{
		{"default loopback", "", "127.0.0.1:1234", "192.0.2.20"},
		{"explicit chain", "127.0.0.1,192.0.2.0/24", "127.0.0.1:1234", "203.0.113.10"},
		{"none", "none", "127.0.0.1:1234", "127.0.0.1"},
		{"untrusted peer", "192.0.2.0/24", "198.51.100.12:1234", "198.51.100.12"},
		{"ipv6 loopback", "::1,192.0.2.0/24", "[::1]:1234", "203.0.113.10"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("TRUSTED_PROXIES", tc.configured)
			outer, inner := gin.New(), gin.New()
			require.NoError(t, ConfigureTrustedProxies(outer))
			proxies, _, err := common.ResolveTrustedProxies(tc.configured)
			require.NoError(t, err)
			require.NoError(t, common.ConfigureTrustedProxies(inner, proxies))
			for _, engine := range []*gin.Engine{outer, inner} {
				engine.GET("/ip", func(c *gin.Context) { c.String(http.StatusOK, c.ClientIP()) })
				request := httptest.NewRequest(http.MethodGet, "/ip", nil)
				request.RemoteAddr = tc.remote
				request.Header.Set("X-Forwarded-For", "203.0.113.10, 192.0.2.20")
				request.Header.Set("X-Real-IP", "203.0.113.99")
				w := httptest.NewRecorder()
				engine.ServeHTTP(w, request)
				require.Equal(t, tc.expected, w.Body.String())
			}
		})
	}
}

func TestTrustedProxyConfigurationRejectsInvalidSettings(t *testing.T) {
	for _, value := range []string{"none,127.0.0.1", ", ,", "not-an-ip", "192.0.2.0/99"} {
		t.Run(value, func(t *testing.T) {
			t.Setenv("TRUSTED_PROXIES", value)
			require.Error(t, ConfigureTrustedProxies(gin.New()))
		})
	}
	proxies, _, err := common.ResolveTrustedProxies("")
	require.NoError(t, err)
	proxies[0] = "changed"
	next, _, err := common.ResolveTrustedProxies("")
	require.NoError(t, err)
	require.NotEqual(t, "changed", next[0], "default configuration must be copied for each engine")
}

func TestGeoBlockPageUsesTrustedClientIPAndEscapesMetadata(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", "none")
	engine := gin.New()
	require.NoError(t, ConfigureTrustedProxies(engine))
	engine.GET("/blocked", func(c *gin.Context) {
		c.Data(http.StatusForbidden, "text/html; charset=utf-8", renderGeoBlockedPage(c))
	})
	request := httptest.NewRequest(http.MethodGet, "/blocked", nil)
	request.RemoteAddr = "198.51.100.12:1234"
	request.Header.Set("X-Forwarded-For", `<script>alert(1)</script>`)
	request.Header.Set("CF-Connecting-IP", "203.0.113.99")
	request.Header.Set("CF-Ray", `<img src=x onerror=alert(2)>`)
	request.Header.Set("CF-IPCountry", `<script>alert(3)</script>`)
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, request)
	page := w.Body.String()
	require.Contains(t, page, "198.51.100.12")
	require.NotContains(t, page, "203.0.113.99")
	require.NotContains(t, page, "<script>")
	require.NotContains(t, page, "<img")
	require.Contains(t, page, "&lt;img")
}
