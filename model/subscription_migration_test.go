package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Match the schema produced by Gorm before provider tagging was introduced.
type paymentMigrationLegacyTopUp struct {
	Id            int
	UserId        int `gorm:"index"`
	Amount        int64
	Money         float64
	TradeNo       string `gorm:"unique;type:varchar(255);index"`
	PaymentMethod string `gorm:"type:varchar(50)"`
	CreateTime    int64
	CompleteTime  int64
	Status        string
}

func (paymentMigrationLegacyTopUp) TableName() string { return "top_ups" }

func TestBillingMigrationPreservesWalletOverflowAndSelfUse(t *testing.T) {
	for _, existingColumn := range []bool{false, true} {
		name := "legacy_without_column"
		if existingColumn {
			name = "explicit_choices"
		}
		t.Run(name, func(t *testing.T) {
			previousDB, previousSQLite := DB, common.UsingSQLite
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			DB, common.UsingSQLite = db, true
			t.Cleanup(func() {
				DB, common.UsingSQLite = previousDB, previousSQLite
				_ = sqlDB.Close()
			})
			require.NoError(t, db.AutoMigrate(&Option{}))
			require.NoError(t, db.Create(&Option{Key: "SelfUseModeEnabled", Value: "true"}).Error)
			require.NoError(t, db.Exec(`CREATE TABLE subscription_plans (id integer PRIMARY KEY, title varchar(128) NOT NULL, price_amount decimal(10,6) NOT NULL DEFAULT 0)`).Error)
			require.NoError(t, db.Exec(`INSERT INTO subscription_plans (id, title) VALUES (1, 'legacy')`).Error)
			ddl := `CREATE TABLE user_subscriptions (id integer PRIMARY KEY`
			if existingColumn {
				ddl += `, allow_wallet_overflow numeric`
			}
			require.NoError(t, db.Exec(ddl+`)`).Error)
			if existingColumn {
				require.NoError(t, db.Exec(`INSERT INTO user_subscriptions (id, allow_wallet_overflow) VALUES (1, NULL), (2, 0), (3, 1)`).Error)
			} else {
				require.NoError(t, db.Exec(`INSERT INTO user_subscriptions (id) VALUES (1)`).Error)
			}
			require.NoError(t, db.AutoMigrate(&paymentMigrationLegacyTopUp{}))
			require.NoError(t, db.Exec(`INSERT INTO top_ups (id, payment_method, trade_no) VALUES (1, 'epay', 'legacy-epay'), (2, 'alipay', 'legacy-alipay'), (3, 'stripe', 'legacy-stripe')`).Error)
			for i := 0; i < 2; i++ {
				require.NoError(t, migrateDB(), "migration must also work on restart")
				var legacyTopUps []TopUp
				require.NoError(t, db.Order("id").Find(&legacyTopUps).Error)
				require.Equal(t, PaymentProviderEpay, legacyTopUps[0].PaymentProvider)
				require.Equal(t, PaymentProviderAlipay, legacyTopUps[1].PaymentProvider)
				require.Empty(t, legacyTopUps[2].PaymentProvider, "do not infer a provider for unrelated legacy payment methods")
				var legacy UserSubscription
				require.NoError(t, db.First(&legacy, 1).Error)
				require.True(t, legacy.AllowWalletOverflow)
				if existingColumn {
					var disabled UserSubscription
					require.NoError(t, db.First(&disabled, 2).Error)
					require.False(t, disabled.AllowWalletOverflow)
				}
				var plan SubscriptionPlan
				require.NoError(t, db.First(&plan, 1).Error)
				require.NotNil(t, plan.AllowBalancePay)
				require.True(t, *plan.AllowBalancePay)
				require.NotNil(t, plan.AllowWalletOverflow)
				require.True(t, *plan.AllowWalletOverflow)
				var option Option
				require.NoError(t, db.Where("key = ?", "SelfUseModeEnabled").First(&option).Error)
				require.Equal(t, "true", option.Value)
			}
			plan := &SubscriptionPlan{Title: "new"}
			require.NoError(t, db.Create(plan).Error)
			require.NotNil(t, plan.AllowWalletOverflow)
			require.True(t, *plan.AllowWalletOverflow)
			plan = &SubscriptionPlan{Title: "no overflow", AllowWalletOverflow: common.GetPointer(false)}
			require.NoError(t, db.Create(plan).Error)
			var saved SubscriptionPlan
			require.NoError(t, db.First(&saved, plan.Id).Error)
			require.False(t, *saved.AllowWalletOverflow)
		})
	}
}
