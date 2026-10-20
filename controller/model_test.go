package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListModelsAnthropicHandlesEmptyPricedModelSet(t *testing.T) {
	setupModelListControllerTestDB(t)
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
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

func TestAutoModelListDiscoversExpressionBillingInCurrentTokenGroups(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ModelPricing{}))
	configureTokenAutoGroupsTest(t, "5", `["default","vip"]`)
	withTieredBillingConfig(t, map[string]string{"auto-expression-first": "tiered_expr", "auto-expression-next": "tiered_expr"}, map[string]string{"auto-expression-first": "p + c", "auto-expression-next": "p + c"})
	user := model.User{Id: 981153, Username: "auto-model-discovery", Group: "default"}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "vip", Model: "auto-expression-first", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "auto-expression-next", ChannelId: 2, Enabled: true},
	}).Error)
	for _, limited := range []bool{false, true} {
		response := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(response)
		c.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
		c.Set("id", user.Id)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenGroup, "auto")
		common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, []string{"vip"})
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, limited)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"auto-expression-first": true})
		ListModels(c, constant.ChannelTypeOpenAI)
		var result struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
		require.Len(t, result.Data, 1)
		require.Equal(t, "auto-expression-first", result.Data[0].ID)
	}
}
