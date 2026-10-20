package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelHealthQueryPreservesLiteralEncodedModelNames(t *testing.T) {
	const name = "health-query-test/literal%2Fmodel?x#fragment"
	model.RecordModelHealth(name, "default", model.ModelHealthRecord{Status: "up", Total: 1, CheckedAt: 123})
	model.RecordModelHealth("health-query-test/literal/model?x#fragment", "other", model.ModelHealthRecord{Status: "down", Total: 1, CheckedAt: 124})
	engine := gin.New()
	engine.GET("/api/model-health/status", GetAllModelHealthStatus)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/model-health/status?"+url.Values{"model": {name}}.Encode(), nil))
	require.Equal(t, http.StatusOK, response.Code)
	var result struct {
		Success bool                     `json:"success"`
		Data    []model.ModelGroupHealth `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success)
	require.Len(t, result.Data, 1)
	require.Equal(t, name, result.Data[0].Model)
	require.Equal(t, "default", result.Data[0].Group)
}
