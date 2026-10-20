package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestEnabledAbilitiesKeepDistinctActualGroupsForHealthAggregation(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql"} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == "mysql" {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "abilities.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previous := DB
			DB = db
			t.Cleanup(func() { DB = previous })
			require.NoError(t, db.AutoMigrate(&Ability{}))
			require.NoError(t, db.Create(&[]Ability{
				{ChannelId: 1, Group: "default", Model: "health-model", Enabled: true},
				{ChannelId: 2, Group: "default", Model: "health-model", Enabled: true},
				{ChannelId: 1, Group: "vip", Model: "health-model", Enabled: true},
				{ChannelId: 1, Group: "disabled", Model: "health-model", Enabled: false},
			}).Error)
			require.ElementsMatch(t, []Ability{
				{Group: "default", Model: "health-model"},
				{Group: "vip", Model: "health-model"},
			}, GetEnabledAbilities())
		})
	}
}
