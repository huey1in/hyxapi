package model

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestLogGroupStatisticsUseTheLogDatabaseDialect(t *testing.T) {
	for _, dialect := range []string{common.DatabaseTypeSQLite, common.DatabaseTypeMySQL} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == common.DatabaseTypeMySQL {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "log.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previousMain, previousLog, previousDB, previousColumn := common.MainDatabaseType(), common.LogDatabaseType(), LOG_DB, logGroupCol
			common.SetDatabaseTypes(common.DatabaseTypePostgreSQL, dialect)
			LOG_DB, logGroupCol = db, "`group`"
			t.Cleanup(func() {
				common.SetDatabaseTypes(previousMain, previousLog)
				LOG_DB, logGroupCol = previousDB, previousColumn
			})
			require.NoError(t, db.AutoMigrate(&Log{}))
			require.NoError(t, db.Create(&[]Log{
				{ModelName: "group-test", Username: "test_user", Group: "default", CreatedAt: 100, Type: LogTypeConsume, Quota: 5000, PromptTokens: 1000, UseTime: 2, Other: `{"cache_tokens":400}`},
				{ModelName: "group-test", Group: "default", CreatedAt: 101, Type: LogTypeError},
				{ModelName: "group-test", Group: "other", CreatedAt: 100, Type: LogTypeConsume, PromptTokens: 9000},
			}).Error)
			stats, err := GetModelGroupLogStatRange("group-test", "default", 90, 110)
			require.NoError(t, err)
			require.EqualValues(t, 2, stats.Total)
			require.EqualValues(t, 1, stats.Errors)
			require.EqualValues(t, 2000, stats.AvgLatencyMs)
			require.EqualValues(t, 1000, stats.PromptTokens)
			require.EqualValues(t, 400, stats.CacheTokens)
			quota, err := SumUsedQuota(0, 90, 110, "group%", "test_%", "", 0, "default")
			require.NoError(t, err)
			require.Equal(t, 5000, quota.Quota)
			require.EqualValues(t, 1000, quota.Tokens)
			require.Equal(t, 1, quota.Requests)
		})
	}
}

func TestLogLiveStatPreservesDateFiltersAndImmutableUserScope(t *testing.T) {
	for _, dialect := range []string{common.DatabaseTypeSQLite, common.DatabaseTypeMySQL} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == common.DatabaseTypeMySQL {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "live-log.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previousMain, previousLog, previousDB, previousColumn := common.MainDatabaseType(), common.LogDatabaseType(), LOG_DB, logGroupCol
			common.SetDatabaseTypes(common.DatabaseTypePostgreSQL, dialect)
			LOG_DB, logGroupCol = db, "`group`"
			t.Cleanup(func() {
				common.SetDatabaseTypes(previousMain, previousLog)
				LOG_DB, logGroupCol = previousDB, previousColumn
			})
			require.NoError(t, db.AutoMigrate(&Log{}))
			now := time.Now().Unix()
			base := Log{UserId: 71, Username: "previous_user", ModelName: "model-a", TokenName: "token", ChannelId: 2, Group: "default", CreatedAt: now - 10, Type: LogTypeConsume, Quota: 5, PromptTokens: 3, CompletionTokens: 7}
			rows := []Log{base}
			renamed := base
			renamed.Username, renamed.Quota, renamed.PromptTokens, renamed.CompletionTokens = "current_user", 7, 11, 13
			rows = append(rows, renamed)
			historical := base
			historical.CreatedAt, historical.Quota, historical.PromptTokens, historical.CompletionTokens = now-3600, 9, 100, 200
			rows = append(rows, historical)
			for _, mutate := range []func(*Log){
				func(log *Log) { log.UserId = 72 },
				func(log *Log) { log.Group = "other" },
				func(log *Log) { log.ModelName = "unmatched" },
				func(log *Log) { log.TokenName = "other" },
				func(log *Log) { log.ChannelId = 3 },
				func(log *Log) { log.Type = LogTypeError },
			} {
				other := base
				other.Quota, other.PromptTokens = 9999, 9999
				mutate(&other)
				rows = append(rows, other)
			}
			require.NoError(t, db.Create(&rows).Error)
			userStat, err := SumUserUsedQuota(71, now-3700, now-3500, "model%", "token", 2, "default")
			require.NoError(t, err)
			require.Equal(t, 9, userStat.Quota)
			require.EqualValues(t, 300, userStat.Tokens)
			require.Equal(t, 1, userStat.Requests)
			require.Equal(t, 2, userStat.Rpm)
			require.EqualValues(t, 34, userStat.Tpm)
			adminStat, err := SumUsedQuota(0, now-3700, now-3500, "model%", "current_user", "token", 2, "default")
			require.NoError(t, err)
			require.Zero(t, adminStat.Requests)
			require.Equal(t, 1, adminStat.Rpm)
			require.EqualValues(t, 24, adminStat.Tpm)
			_, err = SumUserUsedQuota(0, 0, 0, "", "", 0, "")
			require.Error(t, err, "an absent actor must not fall back to global usage")
		})
	}
}
