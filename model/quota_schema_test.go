package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUserQuotaSchemaLegacyMySQL(t *testing.T) {
	db := openIsolatedMySQLMigrationDB(t)
	require.NoError(t, db.Exec("CREATE TABLE users (id bigint PRIMARY KEY, quota int, used_quota bigint, aff_quota bigint, aff_history bigint)").Error)
	require.NoError(t, db.Exec("INSERT INTO users VALUES (1, 123, 0, 0, 0)").Error)
	recorder := &migrationSQLRecorder{}
	checked := db.Session(&gorm.Session{Logger: recorder})
	err := ensureUserQuotaColumns(checked, common.DatabaseTypeMySQL)
	require.ErrorContains(t, err, "users.quota uses int")
	require.Empty(t, recorder.schemaMutations(), "reject the legacy wallet without changing its schema or balance")
	t.Setenv("SKIP_64BIT_QUOTA_SCHEMA_CHECK", "true")
	require.NoError(t, ensureUserQuotaColumns(checked, common.DatabaseTypeMySQL))
	t.Setenv("SKIP_64BIT_QUOTA_SCHEMA_CHECK", "false")
	require.NoError(t, db.Exec("ALTER TABLE users MODIFY quota bigint").Error)
	require.NoError(t, ensureUserQuotaColumns(checked, common.DatabaseTypeMySQL))
	var balance int64
	require.NoError(t, db.Raw("SELECT quota FROM users WHERE id = 1").Scan(&balance).Error)
	require.EqualValues(t, 123, balance)
}

func TestUserQuotaSchemaTypeCompatibility(t *testing.T) {
	for _, tc := range []struct {
		dialect  common.DatabaseType
		typeName string
		allowed  bool
	}{
		{common.DatabaseTypeMySQL, "bigint", true},
		{common.DatabaseTypeMySQL, "BIGINT UNSIGNED", true},
		{common.DatabaseTypeMySQL, "unsigned bigint", true},
		{common.DatabaseTypeMySQL, "int", false},
		{common.DatabaseTypePostgreSQL, " int8 ", true},
		{common.DatabaseTypePostgreSQL, "bigint", true},
		{common.DatabaseTypePostgreSQL, "int4", false},
	} {
		require.Equal(t, tc.allowed, is64BitIntegerType(tc.dialect, tc.typeName), "%s/%s", tc.dialect, tc.typeName)
	}
	require.NoError(t, ensureUserQuotaColumns(nil, common.DatabaseTypeSQLite))
}
