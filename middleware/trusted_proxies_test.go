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

func TestTrustedProxyRateLimitSeparatesCloudflareVisitors(t *testing.T) {
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			if backend == "redis" {
				useRateLimitMiniRedis(t)
			} else {
				previousRedisEnabled := common.RedisEnabled
				common.RedisEnabled = false
				t.Cleanup(func() { common.RedisEnabled = previousRedisEnabled })
			}
			t.Setenv("TRUSTED_PROXIES", "172.25.0.1,162.158.0.0/15,2606:4700::/32")
			engine := gin.New()
			require.NoError(t, ConfigureTrustedProxies(engine))
			engine.GET("/limited", rateLimitFactory(2, 60, "PROXYCHAIN:"+t.Name()), func(c *gin.Context) {
				c.String(http.StatusOK, c.ClientIP())
			})
			request := func(peer, forwarded string) *httptest.ResponseRecorder {
				req := httptest.NewRequest(http.MethodGet, "/limited", nil)
				req.RemoteAddr = peer
				req.Header.Set("X-Forwarded-For", forwarded)
				req.Header.Set("X-Real-IP", "198.51.100.99")
				response := httptest.NewRecorder()
				engine.ServeHTTP(response, req)
				return response
			}
			peer := "172.25.0.1:1234"
			visitorA := "203.0.113.11, 162.158.186.50"
			visitorB := "203.0.113.12, 162.158.186.50"
			for range 2 {
				response := request(peer, visitorA)
				require.Equal(t, http.StatusOK, response.Code)
				require.Equal(t, "203.0.113.11", response.Body.String())
			}
			require.Equal(t, http.StatusTooManyRequests, request(peer, visitorA).Code)
			response := request(peer, visitorB)
			require.Equal(t, http.StatusOK, response.Code, "visitors sharing a Cloudflare edge need independent limits")
			require.Equal(t, "203.0.113.12", response.Body.String())
			require.Equal(t, http.StatusTooManyRequests, request(peer, "198.51.100.99, "+visitorA).Code,
				"a forged prefix must not bypass a visitor's exhausted limit")
			require.Equal(t, http.StatusTooManyRequests, request("203.0.113.11:1234", visitorB).Code,
				"an untrusted direct peer must not impersonate another visitor")
			response = request(peer, "2001:db8::123, 2606:4700::123")
			require.Equal(t, http.StatusOK, response.Code)
			require.Equal(t, "2001:db8::123", response.Body.String())
		})
	}
}
