package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPricingUsesAccountGroupsAndDiscountsWithoutChangingPublicQuotes(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	groups, ratios := setting.UserUsableGroups2JSONString(), ratio_setting.GroupRatio2JSONString()
	discounts, auto := ratio_setting.GroupGroupRatio2JSONString(), setting.AutoGroups2JsonString()
	special := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	originalSpecial := special.MarshalJSONString()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(groups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(ratios))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(discounts))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(auto))
		require.NoError(t, types.LoadFromJsonString(special, originalSpecial))
		model.InvalidatePricingCache()
	})
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":2,"vip_only":3}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"pricing_vip":{"vip_only":0.5}}`))
	require.NoError(t, types.LoadFromJsonString(special, `{"pricing_vip":{"-:default":"","+:vip_only":"Private group"}}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip_only","vip_only","hidden"]`))
	user := model.User{Username: "pricing-vip", Group: "pricing_vip"}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&model.Channel{Id: 1, Type: 1, Status: 1}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{ChannelId: 1, Group: "default", Model: "pricing-public", Enabled: true},
		{ChannelId: 1, Group: "vip_only", Model: "pricing-private", Enabled: true},
	}).Error)
	model.InvalidatePricingCache()
	engine := gin.New()
	engine.GET("/pricing", func(c *gin.Context) {
		if c.GetHeader("Test-Account") != "" {
			c.Set("id", user.Id)
		}
		GetPricing(c)
	})
	type pricingResult struct {
		Success bool               `json:"success"`
		Data    []model.Pricing    `json:"data"`
		Ratios  map[string]float64 `json:"group_ratio"`
		Groups  map[string]string  `json:"usable_group"`
		Auto    []string           `json:"auto_groups"`
	}
	request := func(authenticated bool) pricingResult {
		t.Helper()
		response := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/pricing", nil)
		if authenticated {
			req.Header.Set("Test-Account", "vip")
		}
		engine.ServeHTTP(response, req)
		var result pricingResult
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success)
		return result
	}
	public := request(false)
	require.Len(t, public.Data, 1)
	require.Equal(t, "pricing-public", public.Data[0].ModelName)
	require.Equal(t, map[string]float64{"default": 2}, public.Ratios)
	require.Equal(t, []string{"default"}, public.Auto)
	account := request(true)
	require.Len(t, account.Data, 1)
	require.Equal(t, "pricing-private", account.Data[0].ModelName)
	require.Equal(t, map[string]float64{"vip_only": 0.5}, account.Ratios)
	require.NotContains(t, account.Groups, "default")
	require.Equal(t, "Private group", account.Groups["vip_only"])
	require.Equal(t, []string{"vip_only"}, account.Auto)
	require.Equal(t, public, request(false))
	require.Equal(t, 3.0, ratio_setting.GetGroupRatio("vip_only"))
}
