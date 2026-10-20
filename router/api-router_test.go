package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/middleware"
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

// Inspect the registered chain without invoking handlers, DB access or limits.
// Every authenticated API route needs an explicit PAT rule, including a rule
// rejecting PATs when a browser session is required.
func TestAuthenticatedAPIRoutesDeclareAccessTokenPolicy(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	checked := 0
	engine := gin.New()
	engine.Use(func(c *gin.Context) {
		for _, name := range c.HandlerNames() {
			if strings.Contains(name, ".UserAuth.") || strings.Contains(name, ".AdminAuth.") || strings.Contains(name, ".RootAuth.") || strings.Contains(name, ".TryUserAuth.") {
				checked++
				key := c.Request.Method + " " + c.FullPath()
				if _, exists := middleware.AccessTokenRouteRule(key); !exists {
					t.Errorf("authenticated route has no access token policy: %s", key)
				}
				break
			}
		}
		c.AbortWithStatus(http.StatusNoContent)
	})
	SetApiRouter(engine)
	for _, route := range engine.Routes() {
		segments := strings.Split(route.Path, "/")
		for i, segment := range segments {
			if strings.HasPrefix(segment, ":") || strings.HasPrefix(segment, "*") {
				segments[i] = "1"
			}
		}
		engine.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(route.Method, strings.Join(segments, "/"), nil))
	}
	if checked < 100 {
		t.Fatalf("only inspected %d authenticated routes; check middleware detection", checked)
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
