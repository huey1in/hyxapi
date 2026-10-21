package router

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestSetRouterServesPagesOnCurrentSite(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	t.Setenv("FRONTEND_BASE_URL", "https://old-home.example")

	engine := gin.New()
	index := []byte("<!doctype html><title>HyxAPI</title>")
	SetRouter(engine, embed.FS{}, index)
	for _, path := range []string{"/", "/auth?mode=login", "/console", "/pricing", "/token", "/log", "/topup", "/subscription", "/personal", "/notices", "/console/subscription", "/oauth/github?code=test&state=test"} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			if recorder.Code != http.StatusOK || recorder.Body.String() != string(index) {
				t.Fatalf("page %s returned %d: %s", path, recorder.Code, recorder.Body.String())
			}
			if location := recorder.Header().Get("Location"); location != "" {
				t.Fatalf("page redirected to %s", location)
			}
		})
	}
}
