package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestQuotaDataCollectionPreservesExistingHourlyTotals(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql"} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == "mysql" {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "quota.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previousDB, previousCache := DB, CacheQuotaData
			DB, CacheQuotaData = db, make(map[string]*QuotaData)
			t.Cleanup(func() { DB, CacheQuotaData = previousDB, previousCache })
			// Existing installations may have several rows for one user/model/hour.
			type historicalQuotaData struct {
				Id                      int `gorm:"primaryKey"`
				UserID                  int
				Username, ModelName     string
				CreatedAt               int64
				Count, Quota, TokenUsed int
				UseGroup                string `gorm:"default:''"`
				TokenID, ChannelID      int    `gorm:"default:0"`
				NodeName                string `gorm:"default:''"`
			}
			require.NoError(t, db.Table("quota_data").AutoMigrate(&historicalQuotaData{}))
			require.NoError(t, db.Table("quota_data").Create(&[]historicalQuotaData{
				{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3600, Count: 2, Quota: 20, TokenUsed: 5, UseGroup: "a", TokenID: 11},
				{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3600, Count: 3, Quota: 30, TokenUsed: 7, UseGroup: "b", TokenID: 22},
			}).Error)
			require.NoError(t, db.AutoMigrate(&QuotaData{}))
			base := QuotaDataLogParams{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3661, Quota: 10, TokenUsed: 4}
			LogQuotaData(base)
			LogQuotaData(base)
			SaveQuotaDataCache()
			LogQuotaData(base)
			SaveQuotaDataCache()
			var stored []QuotaData
			require.NoError(t, db.Find(&stored).Error)
			require.Len(t, stored, 2)
			for _, load := range []func() ([]*QuotaData, error){
				func() ([]*QuotaData, error) { return GetQuotaDataByUsername("alice", 3600, 7200) },
				func() ([]*QuotaData, error) { return GetQuotaDataByUserId(1, 3600, 7200) },
			} {
				rows, err := load()
				require.NoError(t, err)
				require.Len(t, rows, 1)
				require.Equal(t, 80, rows[0].Quota)
				require.Equal(t, 8, rows[0].Count)
				require.Equal(t, 24, rows[0].TokenUsed)
			}
		})
	}
}

func TestQuotaDataFailedFlushRemainsRetryable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "retry.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	previousDB, previousCache := DB, CacheQuotaData
	DB, CacheQuotaData = db, make(map[string]*QuotaData)
	t.Cleanup(func() { DB, CacheQuotaData = previousDB, previousCache })
	params := QuotaDataLogParams{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3600, Quota: 5}
	LogQuotaData(params)
	SaveQuotaDataCache() // Missing table: this sample must not disappear.
	require.Len(t, CacheQuotaData, 1)
	LogQuotaData(params)
	require.NoError(t, db.AutoMigrate(&QuotaData{}))
	SaveQuotaDataCache()
	require.Empty(t, CacheQuotaData)
	var row QuotaData
	require.NoError(t, db.First(&row).Error)
	require.Equal(t, 2, row.Count)
	require.Equal(t, 10, row.Quota)
}
