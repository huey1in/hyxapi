package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDistributorPreservesOversizeBodyStatus(t *testing.T) {
	require.NoError(t, i18n.Init())
	previous := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = previous })
	engine := gin.New()
	engine.Use(func(c *gin.Context) { defer common.CleanupBodyStorage(c); c.Next() })
	engine.POST("/v1/chat/completions", Distribute(), func(c *gin.Context) { t.Error("oversize request reached relay") })
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"test","input":"`+strings.Repeat("x", 1<<20)+`"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	require.Contains(t, recorder.Body.String(), "request body exceeds")
}
