package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetApiRouterRegistersDataFlowRoutes(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })

	engine := gin.New()
	SetApiRouter(engine)

	registered := make(map[string]bool)
	for _, route := range engine.Routes() {
		if route.Method == http.MethodGet {
			registered[route.Path] = true
		}
	}
	for _, path := range []string{"/api/data/flow", "/api/data/flow/self"} {
		if !registered[path] {
			t.Errorf("missing GET route %s", path)
		}
	}
}

func TestSetApiRouterRejectsRemovedHandoffEndpoint(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })

	engine := gin.New()
	SetApiRouter(engine)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/user/handoff/exchange", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("removed endpoint returned %d, want 404", recorder.Code)
	}
}
