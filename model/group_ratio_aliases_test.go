package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGroupRatioAliasesPersistOneValueWithoutChangingCallerOptions(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql"} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == "mysql" {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "groups.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previousDB, previousMap := DB, common.OptionMap
			previousRatios, previousDiscounts := ratio_setting.GroupRatio2JSONString(), ratio_setting.GroupGroupRatio2JSONString()
			DB, common.OptionMap = db, map[string]string{}
			t.Cleanup(func() {
				DB, common.OptionMap = previousDB, previousMap
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
				require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(previousDiscounts))
			})
			require.NoError(t, db.AutoMigrate(&Option{}))
			for _, row := range []struct{ key, original, replacement string }{
				{"GroupRatio", `{"default":2}`, `{"default":0.5}`},
				{"GroupGroupRatio", `{"vip":{"default":2}}`, `{"vip":{"default":0.5}}`},
			} {
				alias := groupRatioOptionAlias(row.key)
				require.NoError(t, db.Create(&Option{Key: alias, Value: row.original}).Error)
				require.NoError(t, UpdateOption(row.key, row.replacement))
				var count int64
				require.NoError(t, db.Model(&Option{}).Where("`key` = ?", alias).Count(&count).Error)
				require.Zero(t, count)
				require.Equal(t, row.replacement, common.OptionMap[row.key])
				require.Equal(t, row.replacement, common.OptionMap[alias])
				values := map[string]string{alias: row.original}
				require.NoError(t, UpdateOptionsBulk(values))
				require.Equal(t, map[string]string{alias: row.original}, values)
				var persisted Option
				require.NoError(t, db.First(&persisted, "`key` = ?", row.key).Error)
				require.Equal(t, row.original, persisted.Value)
				require.Error(t, UpdateOptionsBulk(map[string]string{row.key: row.original, alias: row.replacement}))
				require.Equal(t, row.original, common.OptionMap[row.key])
			}
		})
	}
}
