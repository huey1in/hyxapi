package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func modelListRequest(t *testing.T, group string, prepare func(*gin.Context)) []dto.OpenAIModels {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, group)
	if prepare != nil {
		prepare(c)
	}
	ListModels(c, constant.ChannelTypeOpenAI)
	var response struct {
		Success bool               `json:"success"`
		Data    []dto.OpenAIModels `json:"data"`
	}
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
	require.True(t, response.Success, w.Body.String())
	return response.Data
}

func TestModelListIntersectsPermissionsAndTokenLimits(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	configureTokenAutoGroupsTest(t, "5", `["default","vip"]`)
	priced := []string{"listed-default", "listed-vip", "listed-off", "gpt-5.4@effort:high", "listed-noroute"}
	for _, name := range priced {
		require.NoError(t, model.SaveModelPricing(&model.ModelPricing{ModelName: name, Enabled: true, InputPrice: 1}))
	}
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: priced[0], ChannelId: 1, Enabled: true},
		{Group: "vip", Model: priced[1], ChannelId: 2, Enabled: true},
		{Group: "default", Model: priced[2], ChannelId: 3, Enabled: false},
		{Group: "default", Model: priced[3], ChannelId: 4, Enabled: true},
	}).Error)
	limit := func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
		common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{
			priced[0]: false, priced[1]: true, priced[2]: true, "gpt-5.4": true, priced[4]: true,
		})
	}
	rows := modelListRequest(t, "default", limit)
	require.Len(t, rows, 1)
	require.Equal(t, priced[3], rows[0].Id, "whitelist grants neither routing nor group permissions")
	rows = modelListRequest(t, "auto", func(c *gin.Context) {
		limit(c)
		common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, []string{"vip"})
	})
	require.Len(t, rows, 1)
	require.Equal(t, priced[1], rows[0].Id)
	rows = modelListRequest(t, "auto", func(c *gin.Context) {
		limit(c)
		common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, []string{"revoked"})
	})
	require.Empty(t, rows, "an invalid custom Auto list must not fall back to global groups")
	rows = modelListRequest(t, "default", func(c *gin.Context) { c.Set("token_groups", []string{"default", "vip"}) })
	require.Len(t, rows, 3, "preserve discovery for the local ordered manual-group policy")
}

func TestModelListSelfUsePreferenceAndBlankExpressions(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	saved := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = saved })
	withTieredBillingConfig(t, map[string]string{"list-empty": "tiered_expr", "list-expr": "tiered_expr"}, map[string]string{"list-empty": "  ", "list-expr": `tier("base", p * 1)`})
	for index, name := range []string{"list-empty", "list-expr", "list-unpriced"} {
		require.NoError(t, db.Create(&model.Ability{Group: "default", Model: name, ChannelId: index + 1, Enabled: true}).Error)
	}
	rows := modelListRequest(t, "default", nil)
	require.Len(t, rows, 1)
	require.Equal(t, "list-expr", rows[0].Id)
	user := model.User{Id: 988117, Username: "list-self-use", Group: "default", Status: common.UserStatusEnabled}
	user.SetSetting(dto.UserSetting{AcceptUnsetRatioModel: true})
	require.NoError(t, db.Create(&user).Error)
	rows = modelListRequest(t, "default", func(c *gin.Context) { c.Set("id", user.Id) })
	require.Len(t, rows, 3)
	operation_setting.SelfUseModeEnabled = true
	require.Len(t, modelListRequest(t, "default", nil), 3)
}

func TestModelListUsesCurrentPreferredOwnerAndEndpointOverrides(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	name := "owner-custom"
	require.NoError(t, model.SaveModelPricing(&model.ModelPricing{ModelName: name, InputPrice: 1, Enabled: true}))
	for index, typ := range []int{constant.ChannelTypeOpenAI, constant.ChannelTypeCodex} {
		channel := model.Channel{Type: typ, Status: common.ChannelStatusEnabled, Name: fmt.Sprintf("owner-%d", index)}
		require.NoError(t, db.Create(&channel).Error)
		priority := int64(index)
		require.NoError(t, db.Create(&model.Ability{Group: "default", Model: name, ChannelId: channel.Id, Enabled: true, Priority: &priority}).Error)
	}
	require.NoError(t, db.Create(&model.Model{ModelName: name, Status: 1, Endpoints: `{"responses":{"path":"/v1/responses"}}`}).Error)
	model.InvalidatePricingCache()
	rows := modelListRequest(t, "default", nil)
	require.Len(t, rows, 1)
	require.Equal(t, channelOwnerName(constant.ChannelTypeCodex), rows[0].OwnedBy)
	require.Contains(t, rows[0].SupportedEndpointTypes, constant.EndpointType("responses"))
}

func TestPluginPricingAndDashboardDiscoveryUseCurrentGeneration(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	previous := jsplugin.DefaultRegistry
	registry := jsplugin.NewRegistry()
	jsplugin.DefaultRegistry = registry
	t.Cleanup(func() { jsplugin.DefaultRegistry = previous; model.InvalidatePricingCache() })
	source := `export const meta={apiVersion:1,key:"list-plugin",name:"List Plugin",version:"1.0.0",author:{name:"test"},models:["plugin-list-model"],channelTypes:[50],fetchMode:"per_task",usageSchema:{seconds:{type:"number",unit:"second"}}};
export function buildSubmitRequest(){return {};}
export function parseSubmitResponse(){return {};}
export function buildQueryRequest(){return {};}
export function parseTaskResult(){return {};}`
	_, err := registry.RegisterFactory(source, jsplugin.Options{})
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "plugin-list-model", ChannelId: 1, Enabled: true}).Error)
	withTieredBillingConfig(t, map[string]string{"plugin-list-model": "ratio"}, nil)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{"list-plugin::plugin-list-model":"tier(\"base\", u(\"seconds\") * 0.1)"}`}))
	rows := modelListRequest(t, "default", nil)
	require.Len(t, rows, 1, "a provider override is usable even without a model-level expression")
	require.Equal(t, "plugin-list-model", rows[0].Id)
	dashboard := func() map[int][]string {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		DashboardListModels(c)
		var response struct {
			Data map[int][]string `json:"data"`
		}
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
		return response.Data
	}
	require.Contains(t, dashboard()[50], "plugin-list-model")
	registry.SetEnabled(false)
	require.NotContains(t, dashboard()[50], "plugin-list-model")
	require.Empty(t, modelListRequest(t, "default", nil))
}
