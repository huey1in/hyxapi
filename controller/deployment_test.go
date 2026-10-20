package controller

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/ionet"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func deploymentFixture(t *testing.T, server *httptest.Server) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{"model_deployment.ionet.enabled": "true", "model_deployment.ionet.api_key": "fixture-key"}
	common.OptionMapRWMutex.Unlock()
	previousFactory := newIoNetClient
	newIoNetClient = func(key string, enterprise bool) *ionet.Client {
		base := "/public"
		if enterprise {
			base = "/enterprise"
		}
		return ionet.NewClientWithConfig(key, server.URL+base, nil)
	}
	t.Cleanup(func() {
		newIoNetClient = previousFactory
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
}

func TestDeploymentControllerUsesActualSDKContracts(t *testing.T) {
	var mu sync.Mutex
	var created, updated, extended map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("X-API-KEY") != "fixture-key" {
			t.Error("missing provider credential")
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.Method + " " + r.URL.Path {
		case "GET /enterprise/hardware/max-gpus-per-container":
			w.Write([]byte(`{"data":{"hardware":[{"hardware_id":3,"hardware_name":"H100","max_gpus_per_container":4,"available":8}],"total":8}}`))
		case "GET /public/locations":
			w.Write([]byte(`{"data":{"locations":[{"id":1,"name":"Test region","available":8}]}}`))
		case "GET /enterprise/available-replicas":
			if r.URL.Query().Get("hardware_qty") != "2" {
				t.Error("GPU quantity was not mapped")
			}
			w.Write([]byte(`{"data":[{"id":1,"name":"Test region","available_replicas":4}]}`))
		case "GET /enterprise/price":
			if r.URL.Query().Get("location_ids") != "[1]" {
				t.Error("region list was not encoded")
			}
			w.Write([]byte(`{"data":{"total_cost_usdc":24,"ionet_fee":1}}`))
		case "POST /enterprise/deploy":
			if err := json.NewDecoder(r.Body).Decode(&created); err != nil {
				t.Error(err)
			}
			w.Write([]byte(`{"deployment_id":"fixture-deployment","status":"deployment requested"}`))
		case "GET /enterprise/deployment/fixture-deployment":
			w.Write([]byte(`{"data":{"id":"fixture-deployment","status":"RUNNING","hardware_id":3,"created_at":"2026-10-19T00:00:00","total_containers":2,"total_gpus":4,"gpus_per_container":2,"locations":[{"id":1,"name":"Test region"}],"container_config":{"image_url":"fixture/image:latest"}}}`))
		case "GET /enterprise/deployment/fixture-deployment/containers":
			w.Write([]byte(`{"data":{"total":1,"workers":[{"container_id":"fixture-container","status":"RUNNING","created_at":"2026-10-19T00:00:00","container_events":[{"time":"2026-10-19T00:00:00","message":"Started"}]}]}}`))
		case "GET /enterprise/deployment/fixture-deployment/container/fixture-container":
			w.Write([]byte(`{"container_id":"fixture-container","created_at":"2026-10-19T00:00:00","status":"running"}`))
		case "GET /public/deployment/fixture-deployment/log/fixture-container":
			w.Write([]byte("fixture log\n"))
		case "PATCH /enterprise/deployment/fixture-deployment":
			if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
				t.Error(err)
			}
			w.Write([]byte(`{"deployment_id":"fixture-deployment","status":"updating"}`))
		case "GET /enterprise/clusters/check_cluster_name_availability":
			w.Write([]byte(`true`))
		case "PUT /enterprise/clusters/fixture-deployment/update-name":
			w.Write([]byte(`{"status":"updated","message":"ok"}`))
		case "POST /enterprise/deployment/fixture-deployment/extend":
			if err := json.NewDecoder(r.Body).Decode(&extended); err != nil {
				t.Error(err)
			}
			w.Write([]byte(`{"data":{"id":"fixture-deployment","status":"running","created_at":"2026-10-19T00:00:00"}}`))
		case "DELETE /enterprise/deployment/fixture-deployment":
			w.Write([]byte(`{"deployment_id":"fixture-deployment","status":"termination requested"}`))
		default:
			t.Errorf("unexpected SDK request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	deploymentFixture(t, server)
	engine := gin.New()
	engine.GET("/settings", GetModelDeploymentSettings)
	engine.POST("/test", TestIoNetConnection)
	engine.GET("/hardware", GetHardwareTypes)
	engine.GET("/locations", GetLocations)
	engine.GET("/replicas", GetAvailableReplicas)
	engine.POST("/price", GetPriceEstimation)
	engine.POST("/", CreateDeployment)
	engine.GET("/:id", GetDeployment)
	engine.GET("/:id/containers", ListDeploymentContainers)
	engine.GET("/:id/containers/:container_id", GetContainerDetails)
	engine.GET("/:id/logs", GetDeploymentLogs)
	engine.PUT("/:id", UpdateDeployment)
	engine.PUT("/:id/name", UpdateDeploymentName)
	engine.POST("/:id/extend", ExtendDeployment)
	engine.DELETE("/:id", DeleteDeployment)
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/settings", ""}, {"POST", "/test", "{}"}, {"GET", "/hardware", ""}, {"GET", "/locations", ""}, {"GET", "/replicas?hardware_id=3&gpu_count=2", ""},
		{"POST", "/price", `{"location_ids":[1],"hardware_id":3,"gpus_per_container":2,"replica_count":2,"duration_hours":1}`},
		{"POST", "/", `{"resource_private_name":"inference","location_ids":[1],"hardware_id":3,"gpus_per_container":2,"duration_hours":1,"container_config":{"replica_count":2},"registry_config":{"image_url":"fixture/image:latest"}}`},
		{"GET", "/fixture-deployment", ""}, {"GET", "/fixture-deployment/containers", ""}, {"GET", "/fixture-deployment/containers/fixture-container", ""}, {"GET", "/fixture-deployment/logs?container_id=fixture-container", ""},
		{"PUT", "/fixture-deployment", `{"env_variables":{},"entrypoint":[],"traffic_port":0}`}, {"PUT", "/fixture-deployment/name", `{"name":"renamed"}`},
		{"POST", "/fixture-deployment/extend", `{"duration_hours":2}`}, {"DELETE", "/fixture-deployment", ""},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			engine.ServeHTTP(recorder, req)
			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.True(t, response.Success, response.Message)
			if tc.path == "/settings" {
				require.NotContains(t, recorder.Body.String(), "fixture-key")
			}
		})
	}
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, "inference", created["resource_private_name"])
	require.Equal(t, map[string]any{}, updated["env_variables"], "explicit clear survives SDK serialization")
	require.Equal(t, []any{}, updated["entrypoint"])
	require.EqualValues(t, 0, updated["traffic_port"])
	require.EqualValues(t, 2, extended["duration_hours"])
}

func TestDeploymentControllerPropagatesRequestCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }))
	defer server.Close()
	deploymentFixture(t, server)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("GET", "/id", nil).WithContext(ctx)
	c.Params = gin.Params{{Key: "id", Value: "id"}}
	GetDeployment(c)
	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.ErrorIs(t, ctx.Err(), context.DeadlineExceeded)
}
