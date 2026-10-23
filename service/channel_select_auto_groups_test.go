package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelSelectAutoGroupsTest(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRetryTimes := common.RetryTimes
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalSpecialRatios := ratio_setting.GroupGroupRatio2JSONString()
	specialGroups := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	originalSpecialGroups := specialGroups.MarshalJSONString()
	originalMaxTokenAutoGroups := setting.GetMaxTokenAutoGroups()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.RetryTimes = 0

	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`[]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{}`))
	require.NoError(t, types.LoadFromJsonString(specialGroups, `{}`))
	require.NoError(t, setting.UpdateMaxTokenAutoGroups("2"))

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RetryTimes = originalRetryTimes
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(originalSpecialRatios))
		require.NoError(t, types.LoadFromJsonString(specialGroups, originalSpecialGroups))
		require.NoError(t, setting.UpdateMaxTokenAutoGroups(fmt.Sprintf("%d", originalMaxTokenAutoGroups)))

		if originalMemoryCacheEnabled && originalDB != nil &&
			originalDB.Migrator().HasTable(&model.Channel{}) && originalDB.Migrator().HasTable(&model.Ability{}) {
			model.InitChannelCache()
		}
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	return db
}

func createChannelSelectAutoGroupsChannel(t *testing.T, db *gorm.DB, id int, group, modelName string) {
	t.Helper()
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func TestCacheGetRandomSatisfiedChannelUsesTokenAutoGroupsWhenGlobalAutoIsEmpty(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "auto-groups-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2101, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2102, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	first, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2102, first.Id)
	assert.Equal(t, "default", selectedGroup)
	assert.Equal(t, "default", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
	assert.Empty(t, setting.GetAutoGroups(), "the selection must not depend on the global Auto list")

	param.IncreaseRetry()
	second, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2101, second.Id)
	assert.Equal(t, "vip", selectedGroup)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}

func TestResponsesWebSocketAutoGroupSelectionHonorsOrderAndRevocation(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
	const modelName = "auto-ws-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2201, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2202, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id IN ?", []int{2201, 2202}).Update("setting", `{"responses_websocket_enabled":true}`).Error)
	model.InitChannelCache()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("responses_websocket", true)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	param := &RetryParam{Ctx: c, TokenGroup: "auto", ModelName: modelName}
	channel, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 2201, channel.Id)
	require.Equal(t, "vip", group)
	c.Set("responses_ws_channel_id", 2201)
	channel, group, err = CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, "vip", group)
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
	_, _, err = CacheGetRandomSatisfiedChannel(param)
	require.Error(t, err, "a locked connection cannot escape a revoked token group")
	c.Set("responses_ws_channel_id", 0)
	channel, group, err = CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, 2202, channel.Id)
	require.Equal(t, "default", group)
}

func TestAutoGroupsDiscoverPermittedGroupsAndApplyEffectiveRates(t *testing.T) {
	setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["vip","default","removed"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","free":"Free","removed":"Removed","unpriced":"Unpriced"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2,"free":0,"partner":3,"removed":0.1,"forbidden":0}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"default":{"vip":0.5,"partner":0.5}}`))
	require.NoError(t, types.LoadFromJsonString(ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup, `{"default":{"-:removed":"","+:partner":"Partner"}}`))

	require.Equal(t, []string{"free", "vip", "partner", "default"}, GetUserAutoGroup("default"))
	require.Equal(t, []string{"default", "free", "partner", "vip"}, GetUserSelectableGroups("default"))
	// The explicit restriction and the current limit remain in force, even
	// when a cheaper group exists outside this token's snapshot.
	require.Equal(t, []string{"vip", "default"}, FilterUserTokenAutoGroups("default", []string{"removed", "default", "default", "vip", "free"}))
	require.Empty(t, FilterUserTokenAutoGroups("default", []string{"removed", "forbidden", "unpriced"}))

	// Rates are resolved for each request; a later pricing change takes effect.
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{"default":{"vip":4,"partner":4}}`))
	require.Equal(t, []string{"free", "default", "vip", "partner"}, GetUserAutoGroup("default"))
}

func TestAutoRoutingSelectsCheapestAvailableGroupForEachModel(t *testing.T) {
	for _, memoryCache := range []bool{false, true} {
		t.Run(fmt.Sprintf("memory_cache_%t", memoryCache), func(t *testing.T) {
			db := setupChannelSelectAutoGroupsTest(t)
			common.MemoryCacheEnabled = memoryCache
			require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default"]`))
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","economy":"Economy","disabled":"Disabled"}`))
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2,"economy":0.5,"disabled":0}`))
			createChannelSelectAutoGroupsChannel(t, db, 2301, "default", "shared-model")
			createChannelSelectAutoGroupsChannel(t, db, 2302, "vip", "premium-only-model")
			createChannelSelectAutoGroupsChannel(t, db, 2303, "economy", "shared-model")
			createChannelSelectAutoGroupsChannel(t, db, 2304, "disabled", "shared-model")
			require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2301).Update("setting", `{"responses_websocket_enabled":true}`).Error)
			require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2304).Update("status", common.ChannelStatusManuallyDisabled).Error)
			require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2304).Update("enabled", false).Error)
			model.InitChannelCache()
			for _, tc := range []struct {
				model         string
				onlyWebSocket bool
				wantGroup     string
				wantID        int
			}{
				{"shared-model", false, "economy", 2303},
				{"premium-only-model", false, "vip", 2302},
				{"shared-model", true, "default", 2301},
				{"missing-model", false, "auto", 0},
			} {
				ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
				common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
				if tc.onlyWebSocket {
					GetChannelConstraints(ctx).AddFilter(dto.ChannelFilter{Kind: dto.FilterResponsesWebSocket})
				}
				channel, group, err := CacheGetRandomSatisfiedChannel(&RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: tc.model})
				require.NoError(t, err)
				require.Equal(t, tc.wantGroup, group)
				if tc.wantID == 0 {
					require.Nil(t, channel)
				} else {
					require.NotNil(t, channel)
					require.Equal(t, tc.wantID, channel.Id)
					require.Equal(t, group, common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup), "billing must use the selected group")
				}
			}
		})
	}
}

func TestAutoRoutingAffinityCannotOverrideCheapestGroup(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "affinity-cost-model"
	createChannelSelectAutoGroupsChannel(t, db, 2401, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2402, "default", modelName)
	model.InitChannelCache()
	rule := operation_setting.ChannelAffinityRule{
		Name: t.Name(), ModelRegex: []string{"^affinity-cost-model$"},
		KeySources:      []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Affinity-Key"}},
		IncludeRuleName: true, SessionMode: "prefer",
	}
	affinity := operation_setting.GetChannelAffinitySetting()
	originalAffinity := *affinity
	affinity.Enabled = true
	affinity.Rules = []operation_setting.ChannelAffinityRule{rule}
	t.Cleanup(func() { *affinity = originalAffinity })
	cacheKey := buildChannelAffinityCacheKeySuffix(rule, modelName, "auto", t.Name())
	cache := getChannelAffinityCache()
	t.Cleanup(func() { _, _ = cache.DeleteMany([]string{cacheKey}) })

	for _, preferredID := range []int{2401, 2402} {
		require.NoError(t, cache.SetWithTTL(cacheKey, preferredID, time.Minute))
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		ctx.Request.Header.Set("X-Affinity-Key", t.Name())
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		channel, group, err := SelectChannelForRequest(ctx, modelName, &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName})
		require.Nil(t, err)
		require.NotNil(t, channel)
		require.Equal(t, 2402, channel.Id)
		require.Equal(t, "default", group)
		require.Equal(t, "default", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
	}
}
