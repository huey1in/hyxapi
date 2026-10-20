package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPerformancePublicAccessFollowsPricingVisibility(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	previousMap := common.OptionMap
	previous, existed := common.OptionMap["HeaderNavModules"]
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if existed {
			common.OptionMap["HeaderNavModules"] = previous
		} else {
			delete(common.OptionMap, "HeaderNavModules")
		}
		if previousMap == nil {
			common.OptionMap = nil
		}
	})
	for _, tc := range []struct {
		setting string
		status  int
	}{
		{`{"pricing":{"enabled":true,"requireAuth":false}}`, http.StatusOK},
		{`{"pricing":{"enabled":true,"requireAuth":true}}`, http.StatusUnauthorized},
		{`{"pricing":{"enabled":false}}`, http.StatusUnauthorized},
	} {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["HeaderNavModules"] = tc.setting
		common.OptionMapRWMutex.Unlock()
		engine := gin.New()
		engine.GET("/api/perf-metrics", HeaderNavModulePublicOrUserAuth("pricing"), func(c *gin.Context) { c.Status(http.StatusOK) })
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/perf-metrics", nil))
		require.Equal(t, tc.status, recorder.Code)
	}
}
