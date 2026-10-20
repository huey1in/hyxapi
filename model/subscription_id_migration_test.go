package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSQLiteSubscriptionPlanIDsPreserveDeletedPlanHistory(t *testing.T) {
	for _, key := range []string{"id integer PRIMARY KEY", "`id` integer, PRIMARY KEY (`id`)"} {
		t.Run(key, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "plans.db")
			db, err := gorm.Open(sqlite.Open(common.SQLiteDSN(path)), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			require.NoError(t, db.Exec("CREATE TABLE subscription_plans (title text UNIQUE, price_amount decimal(10,6), metadata text DEFAULT 'x,y''z', "+key+")").Error)
			require.NoError(t, db.Exec("CREATE INDEX plan_price_index ON subscription_plans(price_amount) WHERE price_amount > 0").Error)
			require.NoError(t, db.Exec("CREATE TABLE plan_events (id integer)").Error)
			require.NoError(t, db.Exec("CREATE TRIGGER plan_created AFTER INSERT ON subscription_plans BEGIN INSERT INTO plan_events VALUES (NEW.id); END").Error)
			require.NoError(t, db.Exec("INSERT INTO subscription_plans (id,title,price_amount) VALUES (4,'existing',2.123456)").Error)
			for i, table := range []string{"user_subscriptions", "subscription_orders", "subscription_redemptions"} {
				require.NoError(t, db.Exec("CREATE TABLE "+table+" (plan_id integer)").Error)
				require.NoError(t, db.Exec("INSERT INTO "+table+" VALUES (?)", 100+i).Error)
			}
			for range 2 {
				require.NoError(t, migrateSubscriptionPlanIDsSQLite(db), "migration must be idempotent")
			}
			var metadata string
			require.NoError(t, db.Raw("SELECT metadata FROM subscription_plans WHERE id=4").Scan(&metadata).Error)
			require.Equal(t, "x,y'z", metadata)
			var price float64
			require.NoError(t, db.Raw("SELECT price_amount FROM subscription_plans WHERE id=4").Scan(&price).Error)
			require.Equal(t, 2.123456, price)
			var objects int64
			require.NoError(t, db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('plan_price_index','plan_created')").Scan(&objects).Error)
			require.EqualValues(t, 2, objects)
			require.Error(t, db.Exec("INSERT INTO subscription_plans (title) VALUES ('existing')").Error, "retain uniqueness")
			require.NoError(t, db.Exec("INSERT INTO subscription_plans (title) VALUES ('new')").Error)
			var first int
			require.NoError(t, db.Raw("SELECT id FROM subscription_plans WHERE title='new'").Scan(&first).Error)
			require.Greater(t, first, 102, "never bind new plans to an orphaned purchase, order, or redemption")
			require.NoError(t, db.Exec("DELETE FROM subscription_plans WHERE id=?", first).Error)
			require.NoError(t, sqlDB.Close())
			db, err = gorm.Open(sqlite.Open(common.SQLiteDSN(path)), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err = db.DB()
			require.NoError(t, err)
			require.NoError(t, migrateSubscriptionPlanIDsSQLite(db))
			require.NoError(t, db.Exec("INSERT INTO subscription_plans (title) VALUES ('after restart')").Error)
			var second int
			require.NoError(t, db.Raw("SELECT id FROM subscription_plans WHERE title='after restart'").Scan(&second).Error)
			require.Greater(t, second, first, "retain the high-water mark even after deletion and restart")
			var triggerRows int64
			require.NoError(t, db.Raw("SELECT COUNT(*) FROM plan_events WHERE id=?", second).Scan(&triggerRows).Error)
			require.EqualValues(t, 1, triggerRows)
		})
	}
}

func TestSQLiteSubscriptionPlanIDMigrationRollsBackWithExternalForeignKey(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	for _, sql := range []string{
		"PRAGMA foreign_keys=ON",
		"CREATE TABLE subscription_plans (id integer PRIMARY KEY, title text)",
		"INSERT INTO subscription_plans VALUES (4,'retained')",
		"CREATE TABLE external_plan_reference (plan_id integer REFERENCES subscription_plans(id) ON DELETE CASCADE)",
		"INSERT INTO external_plan_reference VALUES (4)",
	} {
		require.NoError(t, db.Exec(sql).Error)
	}
	require.Error(t, migrateSubscriptionPlanIDsSQLite(db))
	var title string
	require.NoError(t, db.Raw("SELECT title FROM subscription_plans WHERE id=4").Scan(&title).Error)
	require.Equal(t, "retained", title)
	require.False(t, db.Migrator().HasTable("subscription_plans_monotonic_ids"))
	var references int64
	require.NoError(t, db.Table("external_plan_reference").Count(&references).Error)
	require.EqualValues(t, 1, references)
}
