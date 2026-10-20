package model

import "gorm.io/gorm"

// migrateRemovedUserRequestCount retires the counter without touching balances.
func migrateRemovedUserRequestCount(db *gorm.DB) error {
	if !db.Migrator().HasTable(&User{}) || !db.Migrator().HasColumn(&User{}, "request_count") {
		return nil
	}
	// Native SQLite DDL preserves indexes and triggers; its GORM DropColumn
	// implementation rebuilds the table and discards those objects.
	return db.Exec("ALTER TABLE users DROP COLUMN request_count").Error
}
