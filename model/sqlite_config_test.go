package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSQLiteCustomPathPreservesConcurrencyDefaults(t *testing.T) {
	for _, test := range []struct {
		name, query string
		wantTimeout int
	}{
		{name: "plain filename", wantTimeout: 30000},
		{name: "additional pragma", query: "?_pragma=foreign_keys(1)", wantTimeout: 30000},
		{name: "explicit timeout", query: "?_pragma=busy_timeout(17000)", wantTimeout: 17000},
	} {
		t.Run(test.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(common.SQLiteDSN(filepath.Join(t.TempDir(), "custom.db")+test.query)), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			var timeout int
			var journal string
			require.NoError(t, db.Raw("PRAGMA busy_timeout").Scan(&timeout).Error)
			require.NoError(t, db.Raw("PRAGMA journal_mode").Scan(&journal).Error)
			require.Equal(t, test.wantTimeout, timeout)
			require.Equal(t, "wal", journal)
			if test.name == "additional pragma" {
				var enabled int
				require.NoError(t, db.Raw("PRAGMA foreign_keys").Scan(&enabled).Error)
				require.Equal(t, 1, enabled)
			}
		})
	}
}
