package model

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestConsoleContentMigrationAndValidatedWrites(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql"} {
		t.Run(dialect, func(t *testing.T) {
			var db *gorm.DB
			if dialect == "mysql" {
				db = openIsolatedMySQLMigrationDB(t)
			} else {
				var err error
				db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "console.db")), &gorm.Config{})
				require.NoError(t, err)
				sqlDB, err := db.DB()
				require.NoError(t, err)
				t.Cleanup(func() { _ = sqlDB.Close() })
			}
			previousDB, previousMap := DB, common.OptionMap
			previousConsole := *console_setting.GetConsoleSetting()
			DB, common.OptionMap = db, map[string]string{}
			t.Cleanup(func() {
				DB, common.OptionMap = previousDB, previousMap
				*console_setting.GetConsoleSetting() = previousConsole
			})
			require.NoError(t, db.AutoMigrate(&Option{}))
			apiInfo := `[{"url":"https://api.example.com/v1","route":"Global","description":"Primary endpoint","color":"blue"}]`
			legacyFAQ := `[{"title":"How to connect?","content":"Use **an API key**."}]`
			require.NoError(t, db.Create(&[]Option{{Key: "ApiInfo", Value: apiInfo}, {Key: "FAQ", Value: legacyFAQ}}).Error)
			require.NoError(t, MigrateRetiredFrontendOptions())
			var apiOption, faqOption Option
			require.NoError(t, db.First(&apiOption, "`key` = ?", "console_setting.api_info").Error)
			require.JSONEq(t, apiInfo, apiOption.Value)
			legacyItems := make([]map[string]string, 75)
			for index := range legacyItems {
				legacyItems[index] = map[string]string{"title": "Question", "content": "Answer"}
			}
			legacyJSON, err := common.Marshal(legacyItems)
			require.NoError(t, err)
			migratedJSON, err := transformLegacyFAQ(string(legacyJSON))
			require.NoError(t, err)
			var migratedItems []map[string]string
			require.NoError(t, common.UnmarshalJsonStr(migratedJSON, &migratedItems))
			require.Len(t, migratedItems, 75, "FAQ migration must retain entries beyond the old 50-item cap")
			require.NoError(t, db.First(&faqOption, "`key` = ?", "console_setting.faq").Error)
			require.JSONEq(t, `[{"question":"How to connect?","answer":"Use **an API key**."}]`, faqOption.Value)
			var count int64
			require.NoError(t, db.Model(&Option{}).Where("`key` IN ?", []string{"ApiInfo", "FAQ"}).Count(&count).Error)
			require.Zero(t, count)
			// A restart migration must preserve the saved current-format setting.
			require.NoError(t, db.Create(&Option{Key: "FAQ", Value: `[{"title":"Stale","content":"Old"}]`}).Error)
			require.NoError(t, MigrateRetiredFrontendOptions())
			require.NoError(t, db.First(&faqOption, "`key` = ?", "console_setting.faq").Error)
			require.JSONEq(t, `[{"question":"How to connect?","answer":"Use **an API key**."}]`, faqOption.Value)
			require.NoError(t, UpdateOptionsBulk(map[string]string{"console_setting.api_info": apiInfo, "console_setting.faq": faqOption.Value, "console_setting.api_info_enabled": "true", "console_setting.faq_enabled": "false"}))
			require.Equal(t, apiInfo, console_setting.GetConsoleSetting().ApiInfo)
			require.False(t, console_setting.GetConsoleSetting().FAQEnabled)
			for _, invalid := range []struct{ key, value string }{
				{"console_setting.api_info", strings.Replace(apiInfo, "https://api.example.com/v1", "javascript:alert(1)", 1)},
				{"console_setting.api_info", strings.Replace(apiInfo, `"blue"`, `"not-a-color"`, 1)},
				{"console_setting.faq", `[{"question":"Missing answer"}]`},
				{"console_setting.faq", `[{"question":"Too long","answer":"` + strings.Repeat("😀", 501) + `"}]`},
				{"console_setting.api_info_enabled", "1"},
				{"console_setting.faq_enabled", "yes"},
			} {
				require.Error(t, UpdateOption(invalid.key, invalid.value))
				require.Error(t, UpdateOptionsBulk(map[string]string{invalid.key: invalid.value, "Notice": "must not be committed"}))
				require.NoError(t, db.Model(&Option{}).Where("`key` = ?", "Notice").Count(&count).Error)
				require.Zero(t, count)
			}
			require.NoError(t, db.First(&apiOption, "`key` = ?", "console_setting.api_info").Error)
			require.JSONEq(t, apiInfo, apiOption.Value)
			// Match JavaScript character counts, allowing Chinese within the same limits.
			require.NoError(t, UpdateOption("console_setting.faq", `[{"question":"`+strings.Repeat("问", 200)+`","answer":"`+strings.Repeat("答", 1000)+`"}]`))
		})
	}
}
