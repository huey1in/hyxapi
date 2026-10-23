package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAccountGroupRulesValidateBeforeSingleAndBulkPersistence(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "groups.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	previousDB, previousMap := DB, common.OptionMap
	previousRatios := ratio_setting.GroupGroupRatio2JSONString()
	special := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup
	previousSpecial := special.MarshalJSONString()
	DB, common.OptionMap = db, map[string]string{}
	t.Cleanup(func() {
		DB, common.OptionMap = previousDB, previousMap
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(previousRatios))
		require.NoError(t, types.LoadFromJsonString(special, previousSpecial))
	})
	require.NoError(t, db.AutoMigrate(&Option{}))
	for _, key := range []string{"GroupGroupRatio", "group_ratio_setting.group_group_ratio"} {
		for _, raw := range []string{"", "null", "[]", `{"vip":null}`, `{"vip":{"default":null}}`, `{"vip":{"default":-1}}`, `{"vip":{"default":"0.8"}}`} {
			require.Error(t, UpdateOption(key, raw), "%s: %s", key, raw)
		}
	}
	const specialKey = "group_ratio_setting.group_special_usable_group"
	for _, raw := range []string{"null", `{"vip":null}`, `{"vip":{"+:":"Premium"}}`, `{"vip":{"default":null}}`, `{"vip":{"default":1}}`} {
		require.Error(t, UpdateOption(specialKey, raw), raw)
	}
	var count int64
	require.NoError(t, db.Model(&Option{}).Count(&count).Error)
	require.Zero(t, count)
	require.Empty(t, common.OptionMap)
	require.NoError(t, UpdateOption("GroupGroupRatio", `{"vip":{"default":0.8}}`))
	ratio, ok := ratio_setting.GetGroupGroupRatio("vip", "default")
	require.True(t, ok)
	require.Equal(t, 0.8, ratio)
	require.NoError(t, UpdateOption("GroupGroupRatio", `{"vip":{"default":0}}`))
	ratio, ok = ratio_setting.GetGroupGroupRatio("vip", "default")
	require.True(t, ok)
	require.Zero(t, ratio)
	require.NoError(t, UpdateOption(specialKey, `{"vip":{"+:premium":"Premium","-:default":""}}`))
	var before, after []Option
	require.NoError(t, db.Find(&before).Error)
	require.Error(t, UpdateOptionsBulk(map[string]string{"GroupGroupRatio": `{"vip":{"default":-1}}`, "unrelated_probe": "must not persist"}))
	require.NoError(t, db.Find(&after).Error)
	require.ElementsMatch(t, before, after)
	require.NotContains(t, common.OptionMap, "unrelated_probe")
	ratio, _ = ratio_setting.GetGroupGroupRatio("vip", "default")
	require.Zero(t, ratio)
}
