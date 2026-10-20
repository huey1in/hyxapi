package model

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestIsClickHouseDSN(t *testing.T) {
	cases := []struct {
		dsn  string
		want bool
	}{
		{"clickhouse://default:pass@localhost:9000/logs", true},
		{"tcp://localhost:9000/logs", true},
		{"http://localhost:8123/logs", true},
		{"https://localhost:8443/logs", true},
		{"postgres://root:pass@localhost:5432/db", false},
		{"postgresql://root:pass@localhost:5432/db", false},
		{"root:pass@tcp(localhost:3306)/db", false},
		{"local", false},
		{"", false},
	}
	for _, c := range cases {
		assert.Equalf(t, c.want, isClickHouseDSN(c.dsn), "dsn=%q", c.dsn)
	}
}

// Exercise the shared SQL query path with zero, non-sequential IDs and repeated
// request IDs. This verifies export/pagination logic without claiming to run a
// ClickHouse server or validate its wire protocol.
func TestClickHouseLogPagingAndExportKeepRepeatedRequestIDs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&Log{}))
	require.NoError(t, db.Exec("CREATE TABLE copy_logs AS SELECT * FROM logs WHERE 1 = 0").Error)
	require.NoError(t, db.Migrator().DropTable(&Log{}))
	require.NoError(t, db.Migrator().RenameTable("copy_logs", "logs"))
	previousDB, previousLog, previousType := LOG_DB, logGroupCol, common.LogDatabaseType()
	LOG_DB, logGroupCol = db, "`group`"
	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)
	t.Cleanup(func() { LOG_DB, logGroupCol = previousDB, previousLog; common.SetLogDatabaseType(previousType) })
	for i := range 507 {
		userID := 71
		if i == 506 {
			userID = 72
		}
		require.NoError(t, db.Exec("INSERT INTO logs (id,user_id,created_at,type,model_name,request_id,upstream_request_id,other) VALUES (0,?,100,2,'model',?,'upstream',?)", userID, fmt.Sprintf("request-%03d", i/2), `{"root_info":{"key":"hidden"},"cache_tokens":5}`).Error)
	}
	rows, total, err := GetAllLogs(2, 0, 0, "model", "", "", 20, 20, 0, "", "", "upstream")
	require.NoError(t, err)
	require.EqualValues(t, 507, total)
	require.Len(t, rows, 20)
	require.Equal(t, 21, rows[0].Id)
	count := 0
	require.NoError(t, StreamLogs(context.Background(), LogFilter{ModelName: "model"}, 71, func(row *Log) error {
		count++
		require.Equal(t, count, row.Id)
		require.Equal(t, 71, row.UserId)
		require.Empty(t, row.UpstreamRequestId)
		require.NotContains(t, row.Other, "hidden")
		return nil
	}))
	require.Equal(t, 506, count)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.Error(t, StreamLogs(ctx, LogFilter{}, 71, func(*Log) error { t.Fatal("canceled export emitted a log"); return nil }))
}

func TestNormalizeClickHouseDSN(t *testing.T) {
	// https without secure gets secure=true appended
	normalized := normalizeClickHouseDSN("https://default:pass@localhost:8443/logs")
	assert.Contains(t, normalized, "secure=true")
	assert.True(t, strings.HasPrefix(normalized, "https://"))

	// https that already specifies secure is left untouched
	assert.Equal(t,
		"https://localhost:8443/logs?secure=false",
		normalizeClickHouseDSN("https://localhost:8443/logs?secure=false"),
	)

	// non-https schemes are returned verbatim
	assert.Equal(t, "clickhouse://localhost:9000/logs", normalizeClickHouseDSN("clickhouse://localhost:9000/logs"))
	assert.Equal(t, "tcp://localhost:9000/logs", normalizeClickHouseDSN("tcp://localhost:9000/logs"))
}

func TestChooseDBRejectsClickHouseForMainDatabase(t *testing.T) {
	original, had := os.LookupEnv("SQL_DSN")
	t.Cleanup(func() {
		if had {
			require.NoError(t, os.Setenv("SQL_DSN", original))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})
	require.NoError(t, os.Setenv("SQL_DSN", "clickhouse://default:pass@localhost:9000/logs"))

	db, dbType, err := chooseDB("SQL_DSN", false)
	require.Error(t, err)
	assert.Nil(t, db)
	assert.Equal(t, common.DatabaseType(""), dbType)
	assert.Contains(t, err.Error(), "does not support ClickHouse")
}

func TestClickHouseLogTTLExpression(t *testing.T) {
	assert.Equal(t, "", clickHouseLogTTLExpression(0))
	assert.Equal(t, "", clickHouseLogTTLExpression(-5))
	assert.Equal(t, "toDateTime(created_at) + INTERVAL 30 DAY DELETE", clickHouseLogTTLExpression(30))
}

func TestClickHouseLogTTLClause(t *testing.T) {
	assert.Equal(t, "", clickHouseLogTTLClause(0))
	assert.Equal(t, "\nTTL toDateTime(created_at) + INTERVAL 7 DAY DELETE", clickHouseLogTTLClause(7))
}

func TestClickHouseLogCreateTableSQL(t *testing.T) {
	withoutTTL := clickHouseLogCreateTableSQL(0)
	assert.Contains(t, withoutTTL, "CREATE TABLE IF NOT EXISTS logs")
	assert.Contains(t, withoutTTL, "ENGINE = MergeTree()")
	assert.Contains(t, withoutTTL, "PARTITION BY toYYYYMM(toDateTime(created_at))")
	assert.Contains(t, withoutTTL, "ORDER BY (created_at, request_id)")
	assert.NotContains(t, withoutTTL, "TTL ")

	withTTL := clickHouseLogCreateTableSQL(30)
	assert.Contains(t, withTTL, "ORDER BY (created_at, request_id)")
	assert.Contains(t, withTTL, "TTL toDateTime(created_at) + INTERVAL 30 DAY DELETE")
}

func TestClickHouseCreateTableHasTTL(t *testing.T) {
	assert.True(t, clickHouseCreateTableHasTTL("CREATE TABLE logs (...)\nTTL toDateTime(created_at) + INTERVAL 30 DAY DELETE"))
	assert.True(t, clickHouseCreateTableHasTTL("CREATE TABLE logs (...) TTL toDateTime(created_at)"))
	assert.False(t, clickHouseCreateTableHasTTL("CREATE TABLE logs (...)\nORDER BY (created_at, request_id)"))
}

func TestClickHouseLogOrder(t *testing.T) {
	assert.Equal(t, "created_at desc, request_id desc", clickHouseLogOrder(""))
	assert.Equal(t, "logs.created_at desc, logs.request_id desc", clickHouseLogOrder("logs."))
}

func TestBuildLogLikeConditionUsesStandardEscape(t *testing.T) {
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		common.SetLogDatabaseType(originalLogDatabaseType)
	})
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)

	condition, pattern, err := buildLogLikeCondition("logs.model_name", "gpt_4%")

	require.NoError(t, err)
	assert.Equal(t, "logs.model_name LIKE ? ESCAPE '!'", condition)
	assert.Equal(t, "gpt!_4%", pattern)
}

func TestBuildLogLikeConditionUsesClickHouseEscaping(t *testing.T) {
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		common.SetLogDatabaseType(originalLogDatabaseType)
	})
	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)

	condition, pattern, err := buildLogLikeCondition("logs.model_name", `gpt_4\mini%`)

	require.NoError(t, err)
	assert.Equal(t, "logs.model_name LIKE ?", condition)
	assert.Equal(t, `gpt\_4\\mini%`, pattern)
}

func TestEnsureLogRequestId(t *testing.T) {
	empty := &Log{}
	ensureLogRequestId(empty)
	assert.NotEmpty(t, empty.RequestId, "empty request id should be backfilled")

	existing := &Log{RequestId: "fixed-request-id"}
	ensureLogRequestId(existing)
	assert.Equal(t, "fixed-request-id", existing.RequestId, "existing request id must be preserved")

	assert.NotPanics(t, func() { ensureLogRequestId(nil) })
}

func TestAssignDisplayLogIds(t *testing.T) {
	logs := []*Log{{}, {}, {}}

	assignDisplayLogIds(logs, 0)
	assert.Equal(t, []int{1, 2, 3}, []int{logs[0].Id, logs[1].Id, logs[2].Id})

	assignDisplayLogIds(logs, 20)
	assert.Equal(t, []int{21, 22, 23}, []int{logs[0].Id, logs[1].Id, logs[2].Id})

	assert.NotPanics(t, func() { assignDisplayLogIds(nil, 0) })
}
