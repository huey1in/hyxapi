package router

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestWebHomePageFollowsVisibility(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
	})

	engine := gin.New()
	index := []byte("<!doctype html><title>HyxAPI</title>")
	SetWebRouter(engine, embed.FS{}, index)
	for _, setting := range []string{`{"home":false}`, `{"home":"false"}`, `{"home":0}`, `{"home":{"enabled":false}}`} {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["HeaderNavModules"] = setting
		common.OptionMapRWMutex.Unlock()
		for _, method := range []string{http.MethodGet, http.MethodHead} {
			for _, target := range []string{"/", "/?from=bookmark", "/index.html", "/index.html?from=bookmark", "/./index.html"} {
				response := httptest.NewRecorder()
				engine.ServeHTTP(response, httptest.NewRequest(method, target, nil))
				if response.Code != http.StatusFound || response.Header().Get("Location") != "/console" {
					t.Fatalf("disabled home %s %s (%s) returned %d: %s", method, target, setting, response.Code, response.Body.String())
				}
				if !strings.Contains(response.Header().Get("Cache-Control"), "no-store") || strings.Contains(response.Body.String(), string(index)) {
					t.Fatalf("disabled home %s %s was cached or served homepage content", method, target)
				}
			}
		}
	}
	for _, target := range []string{"/console", "/auth?mode=login", "/auth?mode=register", "/setup", "/user/reset", "/oauth/github", "/privacy-policy", "/pricing"} {
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, target, nil))
		if response.Code != http.StatusOK || response.Body.String() != string(index) {
			t.Fatalf("home switch blocked unrelated page %s: %d", target, response.Code)
		}
	}
	for _, setting := range []string{"", `{}`, `{"home":true}`, `{"home":false}`, `{"home":true}`} {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["HeaderNavModules"] = setting
		common.OptionMapRWMutex.Unlock()
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
		want := http.StatusOK
		if setting == `{"home":false}` {
			want = http.StatusFound
		}
		if response.Code != want {
			t.Fatalf("live home setting %s returned %d, want %d", setting, response.Code, want)
		}
	}
}
