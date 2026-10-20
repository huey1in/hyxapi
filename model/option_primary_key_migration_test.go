package model

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func checkOptionPrimaryKeyRepair(t *testing.T, db *gorm.DB) {
	t.Helper()
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db = db.WithContext(ctx)
	keyColumn := "`key`"
	if db.Dialector.Name() == "postgres" {
		keyColumn = `"key"`
	}
	require.NoError(t, db.Exec("CREATE TABLE options ("+keyColumn+" varchar(128), value text)").Error)
	for _, row := range []Option{{"same", "first"}, {"same", "last"}, {"empty-value", ""}, {"", "legacy-empty-key"}} {
		require.NoError(t, db.Exec("INSERT INTO options ("+keyColumn+", value) VALUES (?, ?)", row.Key, row.Value).Error)
	}
	require.NoError(t, migrateOptionPrimaryKey(db), "repair must finish with a single pooled connection")
	unique, err := optionsKeyIsUnique(db)
	require.NoError(t, err)
	require.True(t, unique)
	var options []Option
	require.NoError(t, db.Order(keyColumn).Find(&options).Error)
	require.Equal(t, []Option{{"empty-value", ""}, {"same", "last"}}, options)
	require.Error(t, db.Create(&Option{Key: "same", Value: "duplicate"}).Error)
	var backups []string
	if db.Dialector.Name() == "mysql" {
		require.NoError(t, db.Raw("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE ?", optionLegacyTablePrefix+"%").Scan(&backups).Error)
	} else {
		require.NoError(t, db.Raw("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?", optionLegacyTablePrefix+"%").Scan(&backups).Error)
	}
	require.Len(t, backups, 1)
	var count int64
	require.NoError(t, db.Table(backups[0]).Count(&count).Error)
	require.EqualValues(t, 4, count, "the backup preserves every original row")
	recorder := &migrationSQLRecorder{}
	require.NoError(t, migrateOptionPrimaryKey(db.Session(&gorm.Session{Logger: recorder})))
	require.Empty(t, recorder.schemaMutations(), "repeated startup must retain the repaired schema")
}

func TestOptionPrimaryKeyRepairSQLite(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "options.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	checkOptionPrimaryKeyRepair(t, db)
}

func TestOptionPrimaryKeyRepairMySQLSingleConnection(t *testing.T) {
	checkOptionPrimaryKeyRepair(t, openIsolatedMySQLMigrationDB(t))
}

func openIsolatedMySQLMigrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("test MySQL DSN is not configured")
	}
	parsed, err := mysqldriver.ParseDSN(dsn)
	require.NoError(t, err)
	t.Setenv("OPTIONS_MIGRATION_DSN", dsn)
	admin, _, err := chooseDB("OPTIONS_MIGRATION_DSN", false)
	require.NoError(t, err)
	adminSQL, err := admin.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = adminSQL.Close() })
	// Use a new database so the canonical options table can never target the
	// application database supplied in TEST_MYSQL_DSN.
	schemaName := fmt.Sprintf("hyxware_options_migration_%d", time.Now().UnixNano())
	require.NoError(t, admin.Exec("CREATE DATABASE `"+schemaName+"` CHARACTER SET utf8mb4").Error)
	t.Cleanup(func() { _ = admin.Exec("DROP DATABASE `" + schemaName + "`").Error })
	parsed.DBName = schemaName
	t.Setenv("OPTIONS_MIGRATION_DSN", parsed.FormatDSN())
	db, _, err := chooseDB("OPTIONS_MIGRATION_DSN", false)
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	return db
}

func TestChooseDBPreservesActiveDatabaseTypes(t *testing.T) {
	mainType, logType, path := common.MainDatabaseType(), common.LogDatabaseType(), common.SQLitePath
	t.Cleanup(func() { common.SetDatabaseTypes(mainType, logType); common.SQLitePath = path })
	common.SetDatabaseTypes(common.DatabaseTypePostgreSQL, common.DatabaseTypeMySQL)
	common.SQLitePath = filepath.Join(t.TempDir(), "choose.db")
	t.Setenv("ISOLATED_DATABASE_DSN", "local")
	db, databaseType, err := chooseDB("ISOLATED_DATABASE_DSN", true)
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.Equal(t, common.DatabaseTypeSQLite, databaseType)
	require.Equal(t, common.DatabaseTypePostgreSQL, common.MainDatabaseType())
	require.Equal(t, common.DatabaseTypeMySQL, common.LogDatabaseType())
}

func TestDropLegacyBrandingOptions(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql"} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == "mysql" {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "branding.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previous := DB
			DB = db
			t.Cleanup(func() { DB = previous })
			require.NoError(t, db.AutoMigrate(&Option{}))
			require.NoError(t, db.Create(&[]Option{{"SystemName", "old"}, {"Logo", "old"}, {"general_setting.docs_link", "old"}, {"DefaultCollapseSidebar", "true"}, {"ModelRatio", "{}"}}).Error)
			dropLegacyBrandingOptions()
			var options []Option
			require.NoError(t, db.Find(&options).Error)
			require.ElementsMatch(t, []Option{{"general_setting.docs_link", "old"}, {"ModelRatio", "{}"}}, options)
		})
	}
}
