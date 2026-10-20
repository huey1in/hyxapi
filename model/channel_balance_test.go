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

func TestChannelBalanceDatabaseMatrix(t *testing.T) {
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
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "balance_test_"}})
			require.NoError(t, err)
			pool, err := db.DB()
			require.NoError(t, err)
			if dialect == "sqlite" {
				pool.SetMaxOpenConns(1)
			} else {
				pool.SetMaxOpenConns(4)
			}
			previousDB, previousType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			initCol()
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&Channel{}))
				DB = previousDB
				common.SetMainDatabaseType(previousType)
				initCol()
				require.NoError(t, pool.Close())
			})
			require.NoError(t, db.AutoMigrate(&Channel{}))
			channel := &Channel{Type: 1, Key: "old-fixture", Name: "balance fixture", Models: "keep", Balance: 7, BalanceUpdatedTime: 123}
			require.NoError(t, db.Create(channel).Error)
			// A concurrent edit owns the row until its new credential is committed.
			tx := db.Begin()
			require.NoError(t, tx.Error)
			require.NoError(t, tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("key", "rotated-fixture").Error)
			result := make(chan error, 1)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				result <- CommitChannelBalanceSnapshot(ctx, channel, 99)
			}()
			select {
			case err := <-result:
				_ = tx.Rollback()
				t.Fatalf("balance update did not wait for the edit: %v", err)
			case <-time.After(100 * time.Millisecond):
			}
			require.NoError(t, tx.Commit().Error)
			require.ErrorIs(t, <-result, ErrChannelBalanceChanged)
			stored, err := GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.EqualValues(t, 7, stored.Balance)
			require.EqualValues(t, 123, stored.BalanceUpdatedTime)
			// Route and usage changes do not invalidate a balance query or get overwritten.
			require.NoError(t, db.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{"models": "keep,live", "used_quota": 9876}).Error)
			require.NoError(t, CommitChannelBalanceSnapshot(context.Background(), stored, 0))
			current, err := GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.Zero(t, current.Balance)
			require.Equal(t, "keep,live", current.Models)
			require.EqualValues(t, 9876, current.UsedQuota)
			// A persistence error must not update the caller's timestamp or amount.
			before := *current
			require.NoError(t, db.Callback().Update().Before("gorm:update").Register("balance_fixture_failure", func(tx *gorm.DB) { tx.AddError(errors.New("fixture write failure")) }))
			err = CommitChannelBalanceSnapshot(context.Background(), current, 88)
			require.NoError(t, db.Callback().Update().Remove("balance_fixture_failure"))
			require.ErrorContains(t, err, "fixture write failure")
			require.Equal(t, before.Balance, current.Balance)
			require.Equal(t, before.BalanceUpdatedTime, current.BalanceUpdatedTime)
			current, err = GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.Zero(t, current.Balance)
		})
	}
}
