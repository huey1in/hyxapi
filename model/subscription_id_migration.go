package model

import (
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"
)

var (
	sqlitePlanIDDefinition = regexp.MustCompile("(?i)^\\s*(?:id|\"id\"|`id`|\\[id\\])\\s+integer(?:\\s+NOT\\s+NULL)?(?:\\s+PRIMARY\\s+KEY(?:\\s+ASC)?(?:\\s+AUTOINCREMENT)?)?\\s*$")
	sqlitePlanPrimaryKey   = regexp.MustCompile("(?i)^\\s*PRIMARY\\s+KEY\\s*\\(\\s*(?:id|\"id\"|`id`|\\[id\\])\\s*\\)\\s*$")
)

// SQLite's INTEGER PRIMARY KEY reuses deleted IDs. Plans retain references in
// purchase history, so both old schemas and their sequence need reconciliation.
func migrateSubscriptionPlanIDsSQLite(db *gorm.DB) error {
	if db.Dialector.Name() != "sqlite" {
		return nil
	}
	return db.Transaction(func(tx *gorm.DB) error {
		var ddl string
		if err := tx.Raw("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'subscription_plans'").Scan(&ddl).Error; err != nil {
			return err
		}
		if ddl == "" {
			return nil
		}
		start, end := strings.IndexByte(ddl, '('), strings.LastIndexByte(ddl, ')')
		monotonic := false
		if start >= 0 && end > start {
			for _, definition := range splitSQLiteDefinitions(ddl[start+1 : end]) {
				monotonic = monotonic || (sqlitePlanIDDefinition.MatchString(definition) && strings.Contains(strings.ToUpper(definition), "AUTOINCREMENT"))
			}
		}
		if !monotonic {
			if err := rebuildSubscriptionPlanIDsSQLite(tx, ddl); err != nil {
				return fmt.Errorf("migrate subscription plan IDs: %w", err)
			}
		}
		// Deleted plans can have IDs above every surviving plan. Include soft
		// deleted redemption rows and all history when initializing the sequence.
		queries := []string{"SELECT COALESCE(MAX(id), 0) AS id FROM subscription_plans"}
		for _, table := range []string{"user_subscriptions", "subscription_orders", "subscription_redemptions"} {
			if tx.Migrator().HasTable(table) && tx.Migrator().HasColumn(table, "plan_id") {
				queries = append(queries, "SELECT COALESCE(MAX(plan_id), 0) AS id FROM "+table)
			}
		}
		var highest int64
		if err := tx.Raw("SELECT MAX(id) FROM (" + strings.Join(queries, " UNION ALL ") + ")").Scan(&highest).Error; err != nil {
			return err
		}
		result := tx.Exec("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'subscription_plans'", highest)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return tx.Exec("INSERT INTO sqlite_sequence (name, seq) VALUES ('subscription_plans', ?)", highest).Error
		}
		return nil
	})
}

func rebuildSubscriptionPlanIDsSQLite(tx *gorm.DB, ddl string) error {
	start, end := strings.IndexByte(ddl, '('), strings.LastIndexByte(ddl, ')')
	if start < 0 || end <= start || strings.TrimSpace(ddl[end+1:]) != "" {
		return fmt.Errorf("unsupported subscription plan table definition")
	}
	definitions := splitSQLiteDefinitions(ddl[start+1 : end])
	columns := make([]string, 0, len(definitions))
	foundID := false
	for _, definition := range definitions {
		switch {
		case sqlitePlanIDDefinition.MatchString(definition):
			columns = append(columns, "`id` INTEGER PRIMARY KEY AUTOINCREMENT")
			foundID = true
		case sqlitePlanPrimaryKey.MatchString(definition):
			// The primary key is now declared directly on id.
		default:
			columns = append(columns, definition)
		}
	}
	if !foundID {
		return fmt.Errorf("unsupported subscription plan ID definition")
	}
	// The repository stores plan references without foreign-key constraints.
	// Refuse a custom schema that could cascade-delete records during the swap.
	var tables []string
	if err := tx.Raw("SELECT name FROM sqlite_master WHERE type = 'table'").Scan(&tables).Error; err != nil {
		return err
	}
	for _, table := range tables {
		var references []struct{ Table string }
		if err := tx.Raw(`PRAGMA foreign_key_list("` + strings.ReplaceAll(table, `"`, `""`) + `")`).Scan(&references).Error; err != nil {
			return err
		}
		for _, reference := range references {
			if strings.EqualFold(reference.Table, "subscription_plans") {
				return fmt.Errorf("custom foreign key from %s requires an explicit plan table migration", table)
			}
		}
	}
	var objects []struct{ SQL string }
	if err := tx.Raw("SELECT sql FROM sqlite_master WHERE tbl_name = 'subscription_plans' AND type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY type, name").Scan(&objects).Error; err != nil {
		return err
	}
	var fields []struct{ Name string }
	if err := tx.Raw("PRAGMA table_info('subscription_plans')").Scan(&fields).Error; err != nil {
		return err
	}
	names := make([]string, len(fields))
	for i, field := range fields {
		names[i] = `"` + strings.ReplaceAll(field.Name, `"`, `""`) + `"`
	}
	const temporary = "subscription_plans_monotonic_ids"
	for _, statement := range []string{
		"CREATE TABLE " + temporary + " (" + strings.Join(columns, ",") + ")",
		"INSERT INTO " + temporary + " (" + strings.Join(names, ",") + ") SELECT " + strings.Join(names, ",") + " FROM subscription_plans",
		"DROP TABLE subscription_plans",
		"ALTER TABLE " + temporary + " RENAME TO subscription_plans",
	} {
		if err := tx.Exec(statement).Error; err != nil {
			return err
		}
	}
	for _, object := range objects {
		if err := tx.Exec(object.SQL).Error; err != nil {
			return err
		}
	}
	return nil
}

// Table definitions contain commas inside decimal types, checks and defaults.
// Respect nesting and quoted SQL tokens while retaining every unknown column.
func splitSQLiteDefinitions(body string) []string {
	var definitions []string
	start, depth := 0, 0
	var quote byte
	for i := 0; i < len(body); i++ {
		ch := body[i]
		if quote != 0 {
			if ch == quote {
				if i+1 < len(body) && body[i+1] == quote {
					i++
				} else {
					quote = 0
				}
			}
			continue
		}
		switch ch {
		case '\'', '"', '`':
			quote = ch
		case '[':
			quote = ']'
		case '(':
			depth++
		case ')':
			depth--
		case ',':
			if depth == 0 {
				definitions = append(definitions, strings.TrimSpace(body[start:i]))
				start = i + 1
			}
		}
	}
	return append(definitions, strings.TrimSpace(body[start:]))
}
