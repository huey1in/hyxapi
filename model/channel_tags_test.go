package model

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestChannelTagDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "tag_test_"}})
			require.NoError(t, err)
			pool, err := db.DB()
			require.NoError(t, err)
			pool.SetMaxOpenConns(1)
			previousDB, previousType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			initCol()
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&Ability{}, &Channel{}))
				DB = previousDB
				common.SetMainDatabaseType(previousType)
				initCol()
				require.NoError(t, pool.Close())
			})
			require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
			tag, priority, weight := "old", int64(9), uint(4)
			channel := &Channel{Type: 1, Tag: &tag, Name: "tag fixture", Models: "keep", Group: "default", Status: 1, Priority: &priority, Weight: &weight, UsedQuota: 9876, Balance: 31}
			require.NoError(t, channel.Insert())
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			nextTag := "assigned"
			count, err := SetSelectedChannelTags(ctx, []int{channel.Id}, &nextTag)
			require.NoError(t, err)
			require.Equal(t, 1, count)
			var ability Ability
			require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
			require.Equal(t, nextTag, *ability.Tag)
			rename, models, groups := "renamed", "changed", "custom"
			priority, weight = 0, 0
			change := ChannelTagChanges{NewTag: &rename, Models: &models, Groups: &groups, Priority: &priority, Weight: &weight}
			require.NoError(t, db.Callback().Create().Before("gorm:create").Register("tag_fixture_failure", func(tx *gorm.DB) {
				if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "Ability" {
					tx.AddError(errors.New("fixture route failure"))
				}
			}))
			_, err = EditChannelsByTag(ctx, nextTag, change)
			require.NoError(t, db.Callback().Create().Remove("tag_fixture_failure"))
			require.ErrorContains(t, err, "fixture route failure")
			stored, err := GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.Equal(t, nextTag, stored.GetTag())
			require.Equal(t, "keep", stored.Models)
			_, err = EditChannelsByTag(ctx, nextTag, change)
			require.NoError(t, err)
			ability = Ability{}
			require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
			require.Equal(t, rename, *ability.Tag)
			require.Equal(t, "custom", ability.Group)
			require.Equal(t, "changed", ability.Model)
			require.Zero(t, *ability.Priority)
			require.Zero(t, ability.Weight)
			_, err = SetChannelTagStatus(ctx, rename, common.ChannelStatusManuallyDisabled)
			require.NoError(t, err)
			stored, err = GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.Equal(t, 2, stored.Status)
			require.EqualValues(t, 9876, stored.UsedQuota)
			require.EqualValues(t, 31, stored.Balance)
			ability = Ability{}
			require.NoError(t, db.Where("channel_id = ?", channel.Id).First(&ability).Error)
			require.False(t, ability.Enabled)
		})
	}
}
