package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRemovedUserRequestCountMigrationPreservesAccounts(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql"} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == "mysql" {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "usage.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			require.NoError(t, migrateRemovedUserRequestCount(db))
			require.NoError(t, db.AutoMigrate(&User{}))
			require.False(t, db.Migrator().HasColumn(&User{}, "request_count"))
			require.NoError(t, db.Exec("ALTER TABLE users ADD COLUMN request_count int DEFAULT 0").Error)
			require.NoError(t, db.Exec("CREATE INDEX legacy_user_usage_index ON users (used_quota)").Error)
			user := User{Username: "usage-migration", Password: "preserved-hash", Quota: 12345, UsedQuota: 6789, Group: "preserved-group", AuthVersion: 17}
			require.NoError(t, db.Create(&user).Error)
			require.NoError(t, db.Table("users").Where("id = ?", user.Id).Update("request_count", 100).Error)
			for range 2 {
				require.NoError(t, migrateRemovedUserRequestCount(db))
				require.False(t, db.Migrator().HasColumn(&User{}, "request_count"))
				require.True(t, db.Migrator().HasIndex(&User{}, "legacy_user_usage_index"))
				require.True(t, db.Migrator().HasIndex(&User{}, "idx_users_username"))
			}
			var stored User
			require.NoError(t, db.First(&stored, user.Id).Error)
			require.Equal(t, user, stored)
			require.Error(t, db.Create(&User{Username: user.Username, Password: "duplicate", AffCode: "unique-aff"}).Error, "username uniqueness must survive migration")
		})
	}
}
