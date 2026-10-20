package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestQuotaDataDimensionMigrationCollectionAndRoleVisibility(t *testing.T) {
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
			// Exercise the existing schema upgrade, retaining its historical totals.
			type legacyQuotaData struct {
				Id                      int `gorm:"primaryKey"`
				UserID                  int
				Username, ModelName     string
				CreatedAt               int64
				Count, Quota, TokenUsed int
			}
			require.NoError(t, db.Table("quota_data").AutoMigrate(&legacyQuotaData{}))
			require.NoError(t, db.Table("quota_data").Create(&legacyQuotaData{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3600, Count: 1, Quota: 20, TokenUsed: 5}).Error)
			require.NoError(t, db.AutoMigrate(&QuotaData{}, &Token{}, &Channel{}))
			base := QuotaDataLogParams{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3661, Quota: 10, TokenUsed: 4, UseGroup: "vip", TokenID: 11, ChannelID: 1, NodeName: "node-a"}
			LogQuotaData(base)
			LogQuotaData(base)
			for _, mutate := range []func(*QuotaDataLogParams){
				func(p *QuotaDataLogParams) { p.UseGroup = "default" },
				func(p *QuotaDataLogParams) { p.TokenID = 22 },
				func(p *QuotaDataLogParams) { p.ChannelID = 2 },
				func(p *QuotaDataLogParams) { p.NodeName = "node-b" },
			} {
				row := base
				mutate(&row)
				LogQuotaData(row)
			}
			SaveQuotaDataCache()
			// A later flush must increment the exact dimensions only.
			LogQuotaData(base)
			SaveQuotaDataCache()
			var stored []QuotaData
			require.NoError(t, db.Order("quota DESC").Find(&stored).Error)
			require.Len(t, stored, 6)
			require.Equal(t, 30, stored[0].Quota)
			require.Equal(t, 3, stored[0].Count)
			require.Equal(t, int64(3600), stored[0].CreatedAt)
			root, err := GetFlowQuotaData(3600, 7200, "", 0, common.RoleRootUser)
			require.NoError(t, err)
			require.Len(t, root, 5)
			admin, err := GetFlowQuotaData(3600, 7200, "alice", 0, common.RoleAdminUser)
			require.NoError(t, err)
			require.Len(t, admin, 3)
			for _, row := range admin {
				require.Empty(t, row.NodeName)
				require.Zero(t, row.TokenID)
			}
			self, err := GetFlowQuotaData(3600, 7200, "", 1, common.RoleCommonUser)
			require.NoError(t, err)
			require.Len(t, self, 3)
			for _, row := range self {
				require.Empty(t, row.NodeName)
				require.Zero(t, row.ChannelID)
				require.Empty(t, row.Username)
			}
			other, err := GetFlowQuotaData(3600, 7200, "alice", 2, common.RoleCommonUser)
			require.NoError(t, err)
			require.Empty(t, other)
			for _, load := range []func() ([]*QuotaData, error){
				func() ([]*QuotaData, error) { return GetQuotaDataByUsername("alice", 3600, 7200) },
				func() ([]*QuotaData, error) { return GetQuotaDataByUserId(1, 3600, 7200) },
			} {
				rows, err := load()
				require.NoError(t, err)
				require.Len(t, rows, 1)
				require.Equal(t, 90, rows[0].Quota)
				require.Equal(t, 8, rows[0].Count)
				require.Empty(t, rows[0].NodeName)
				require.Zero(t, rows[0].ChannelID)
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
	params := QuotaDataLogParams{UserID: 1, Username: "alice", ModelName: "model", CreatedAt: 3600, Quota: 5, UseGroup: "default"}
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
