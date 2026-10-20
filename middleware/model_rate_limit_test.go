package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestGroupRateLimitsAreIndependentAndFallbackGroupsShareGlobalLimit(t *testing.T) {
	testGroupRateLimits(t, false)
}

func TestGroupRateLimitsRedisIntegration(t *testing.T) {
	address := os.Getenv("REDIS_TEST_ADDR")
	if address == "" {
		t.Skip("set REDIS_TEST_ADDR to a dedicated test Redis instance")
	}
	client := redis.NewClient(&redis.Options{Addr: address, DB: 13})
	require.NoError(t, client.Ping(context.Background()).Err())
	previous := common.RDB
	common.RDB = client
	t.Cleanup(func() { common.RDB = previous; client.Close() })
	testGroupRateLimits(t, true)
}

func testGroupRateLimits(t *testing.T, useRedis bool) {
	require.NoError(t, i18n.Init())
	t.Helper()
	previousRedis := common.RedisEnabled
	previousEnabled, previousDuration := setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitDurationMinutes
	previousCount, previousSuccess := setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount
	previousGroups := setting.ModelRequestRateLimitGroup2JSONString()
	t.Cleanup(func() {
		common.RedisEnabled = previousRedis
		setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitDurationMinutes = previousEnabled, previousDuration
		setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount = previousCount, previousSuccess
		require.NoError(t, setting.UpdateModelRequestRateLimitGroupByJSONString(previousGroups))
	})
	common.RedisEnabled = useRedis
	setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitDurationMinutes = true, 1
	setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount = 1, 100
	require.NoError(t, setting.UpdateModelRequestRateLimitGroupByJSONString(`{"large":[3,100],"small":[1,100],"success":[0,1],"unlimited":[0,0]}`))
	if useRedis {
		// Exercise the group-specific success buckets independently of the
		// token bucket's Redis-version requirements (TIME + writes needs 5+).
		setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount = 0, 1
		require.NoError(t, setting.UpdateModelRequestRateLimitGroupByJSONString(`{"large":[0,3],"small":[0,1],"success":[0,1],"unlimited":[0,0]}`))
	}
	engine := gin.New()
	engine.Use(func(c *gin.Context) {
		c.Set("id", 987654)
		common.SetContextKey(c, constant.ContextKeyTokenGroup, c.Query("group"))
	})
	engine.GET("/", ModelRequestRateLimit(), func(c *gin.Context) {
		if c.Query("fail") != "" {
			c.Status(http.StatusBadGateway)
			return
		}
		c.Status(http.StatusNoContent)
	})
	request := func(group string) int {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/?group="+group, nil))
		return recorder.Code
	}
	for range 2 {
		require.Equal(t, http.StatusNoContent, request("large"))
	}
	require.Equal(t, http.StatusNoContent, request("small"))
	require.Equal(t, http.StatusTooManyRequests, request("small"))
	require.Equal(t, http.StatusNoContent, request("large"))
	require.Equal(t, http.StatusTooManyRequests, request("large"))
	require.Equal(t, http.StatusNoContent, request("fallback-a"))
	require.Equal(t, http.StatusTooManyRequests, request("fallback-b"))
	require.Equal(t, http.StatusBadGateway, request("success&fail=1"))
	require.Equal(t, http.StatusNoContent, request("success"))
	require.Equal(t, http.StatusTooManyRequests, request("success"))
	for range 3 {
		require.Equal(t, http.StatusNoContent, request("unlimited"))
	}
}
