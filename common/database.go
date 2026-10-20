package common

import (
	"net/url"
	"strings"
)

const (
	DatabaseTypeMySQL      = "mysql"
	DatabaseTypeSQLite     = "sqlite"
	DatabaseTypePostgreSQL = "postgres"
	DatabaseTypeClickHouse = "clickhouse"
)

var UsingSQLite = false
var UsingPostgreSQL = false
var LogSqlType = DatabaseTypeSQLite // Default to SQLite for logging SQL queries
var UsingMySQL = false
var SQLitePath = "one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate"

// SQLiteDSN keeps concurrency defaults when SQLITE_PATH supplies a custom
// filename. Explicit DSN settings take precedence.
func SQLiteDSN(path string) string {
	filename, rawQuery, _ := strings.Cut(path, "?")
	query, err := url.ParseQuery(rawQuery)
	if err != nil {
		return path // Let the driver report malformed parameters.
	}
	for _, defaultPragma := range []string{"busy_timeout(30000)", "journal_mode(WAL)"} {
		name, _, _ := strings.Cut(defaultPragma, "(")
		found := false
		for _, pragma := range query["_pragma"] {
			configured := strings.ToLower(strings.TrimSpace(pragma))
			if strings.HasPrefix(configured, name+"(") || strings.HasPrefix(configured, name+"=") {
				found = true
				break
			}
		}
		if !found {
			query.Add("_pragma", defaultPragma)
		}
	}
	if query.Get("_txlock") == "" {
		query.Set("_txlock", "immediate")
	}
	return filename + "?" + query.Encode()
}

func UsingLogDatabase(databaseType string) bool { return LogSqlType == databaseType }

// DatabaseType retains the string representation used by existing adapters.
type DatabaseType = string

func MainDatabaseType() DatabaseType {
	if UsingPostgreSQL {
		return DatabaseTypePostgreSQL
	}
	if UsingMySQL {
		return DatabaseTypeMySQL
	}
	return DatabaseTypeSQLite
}
func LogDatabaseType() DatabaseType { return LogSqlType }
func SetMainDatabaseType(value DatabaseType) {
	UsingSQLite = value == DatabaseTypeSQLite
	UsingMySQL = value == DatabaseTypeMySQL
	UsingPostgreSQL = value == DatabaseTypePostgreSQL
}
func SetLogDatabaseType(value DatabaseType) { LogSqlType = value }
func SetDatabaseTypes(mainType, logType DatabaseType) {
	SetMainDatabaseType(mainType)
	SetLogDatabaseType(logType)
}
func UsingMainDatabase(value DatabaseType) bool { return MainDatabaseType() == value }
