package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListModelsAnthropicHandlesEmptyPricedModelSet(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	ctx.Set(string(constant.ContextKeyTokenModelLimitEnabled), true)
	ctx.Set(string(constant.ContextKeyTokenModelLimit), map[string]bool{})

	require.NotPanics(t, func() {
		ListModels(ctx, constant.ChannelTypeAnthropic)
	})

	var response struct {
		Data    []any  `json:"data"`
		FirstID string `json:"first_id"`
		LastID  string `json:"last_id"`
		HasMore bool   `json:"has_more"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Empty(t, response.Data)
	assert.Empty(t, response.FirstID)
	assert.Empty(t, response.LastID)
	assert.False(t, response.HasMore)
}
