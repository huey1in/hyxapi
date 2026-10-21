package router

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func TestRemovedPublicPageEndpoints(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	engine := gin.New()
	SetApiRouter(engine)
	for _, path := range []string{"/api/rankings", "/api/about"} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusNotFound {
			t.Errorf("removed endpoint %s returned %d, want 404", path, recorder.Code)
		}
		if _, exists := middleware.AccessTokenRouteRule("GET " + path); exists {
			t.Errorf("removed endpoint %s still declares an access token policy", path)
		}
	}
}

func TestUsageFlowEndpointsAreRemoved(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })

	engine := gin.New()
	SetApiRouter(engine)

	for _, path := range []string{"/api/data/flow", "/api/data/flow/self"} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusNotFound {
			t.Errorf("removed endpoint %s returned %d, want 404", path, recorder.Code)
		}
		if _, exists := middleware.AccessTokenRouteRule("GET " + path); exists {
			t.Errorf("removed endpoint %s still declares an access token policy", path)
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

func TestDashboardTokenUsageEndpointsAreRemoved(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	engine := gin.New()
	SetApiRouter(engine)
	for _, path := range []string{"/api/log/token-usage", "/api/log/self/token-usage"} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusNotFound {
			t.Errorf("removed endpoint %s returned %d, want 404", path, recorder.Code)
		}
		if _, exists := middleware.AccessTokenRouteRule("GET " + path); exists {
			t.Errorf("removed endpoint %s still declares an access token policy", path)
		}
	}
}

func TestModelDeploymentEndpointsAreRemoved(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	engine := gin.New()
	SetApiRouter(engine)
	for _, path := range []string{
		"/api/deployments/", "/api/deployments/search", "/api/deployments/settings",
		"/api/deployments/settings/test-connection", "/api/deployments/test-connection",
		"/api/deployments/hardware-types", "/api/deployments/locations",
		"/api/deployments/available-replicas", "/api/deployments/price-estimation",
		"/api/deployments/check-name", "/api/deployments/1", "/api/deployments/1/name",
		"/api/deployments/1/extend", "/api/deployments/1/logs",
		"/api/deployments/1/containers", "/api/deployments/1/containers/1",
	} {
		for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete} {
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
			if recorder.Code != http.StatusNotFound {
				t.Errorf("%s %s returned %d, want 404", method, path, recorder.Code)
			}
		}
	}
}

func TestSessionChatEndpointsAreRemovedWhileAPIChatRemains(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	engine := gin.New()
	SetRelayRouter(engine)
	SetWebRouter(engine, embed.FS{}, []byte("dashboard"))
	for _, path := range []string{"/pg/chat/completions", "/chat/completions"} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, path, nil))
		if recorder.Code != http.StatusNotFound {
			t.Errorf("removed endpoint %s returned %d, want 404", path, recorder.Code)
		}
	}
	for _, route := range engine.Routes() {
		if route.Method == http.MethodPost && route.Path == "/v1/chat/completions" {
			return
		}
	}
	t.Fatal("standard chat completion API is missing")
}
