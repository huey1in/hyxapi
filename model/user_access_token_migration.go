package model

import (
	"slices"

	"gorm.io/gorm"
)

// migrateRemovedUserAccessToken deletes plaintext credentials. Scoped personal
// tokens live in user_access_tokens and are unaffected.
func migrateRemovedUserAccessToken(db *gorm.DB) error {
	if !db.Migrator().HasTable(&User{}) {
		return nil
	}
	for _, column := range []string{"access_token", "access_token_created_at"} {
		if !db.Migrator().HasColumn(&User{}, column) {
			continue
		}
		if db.Dialector.Name() == "sqlite" {
			indexes, err := db.Migrator().GetIndexes(&User{})
			if err != nil {
				return err
			}
			for _, index := range indexes {
				if slices.Contains(index.Columns(), column) {
					if err := db.Migrator().DropIndex(&User{}, index.Name()); err != nil {
						return err
					}
				}
			}
			// Avoid SQLite's GORM table rebuild, which discards unrelated indexes.
			if err := db.Exec("ALTER TABLE users DROP COLUMN " + column).Error; err != nil {
				return err
			}
		} else if err := db.Migrator().DropColumn(&User{}, column); err != nil {
			return err
		}
	}
	return nil
}
