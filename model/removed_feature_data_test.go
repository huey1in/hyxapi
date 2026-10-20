package model

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRemovedFeatureSettingsArePurgedAndCannotBeRestored(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "options.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	previousDB, previousMap := DB, common.OptionMap
	DB, common.OptionMap = db, map[string]string{}
	t.Cleanup(func() { DB, common.OptionMap = previousDB, previousMap })
	require.NoError(t, db.AutoMigrate(&Option{}))
	keys := []string{"model_deployment.ionet.enabled", "model_deployment.ionet.api_key", "Chats", "ChatLink", "ChatLink2", "log_setting.max_range_days"}
	for _, key := range keys {
		require.NoError(t, db.Create(&Option{Key: key, Value: "legacy-value"}).Error)
	}
	active := Option{Key: "Notice", Value: "keep this content"}
	require.NoError(t, db.Create(&active).Error)
	for range 2 {
		require.NoError(t, purgeRemovedFeatureOptions(db))
		var options []Option
		require.NoError(t, db.Find(&options).Error)
		require.Equal(t, []Option{active}, options)
	}
	for _, key := range append(keys, "model_deployment.other.setting") {
		require.ErrorIs(t, UpdateOption(key, "true"), ErrRemovedFeatureOption)
		require.ErrorIs(t, updateOptionMap(key, "true"), ErrRemovedFeatureOption)
		for _, otherKey := range []string{"Notice", "ServerAddress"} {
			require.ErrorIs(t, UpdateOptionsBulk(map[string]string{key: "true", otherKey: "must not persist"}), ErrRemovedFeatureOption)
		}
	}
	var options []Option
	require.NoError(t, db.Find(&options).Error)
	require.Equal(t, []Option{active}, options)
	require.Empty(t, common.OptionMap)
}

func TestRemovedFeatureTokenScopesPreserveOtherPermissionsAndCredentials(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "tokens.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&UserAccessToken{}))
	var tokens []UserAccessToken
	for index := range userAccessTokenCleanupBatchSize + 1 {
		token := UserAccessToken{Id: index + 1, UserId: 1, Name: "existing token", TokenHash: fmt.Sprintf("%064d", index), TokenHint: "keep", ExpiresAt: 12345, CreatedAt: 234}
		if index%2 == 0 {
			require.NoError(t, token.SetScopes([]string{"deployment:read", "model:read", "deployment:write"}))
		} else {
			require.NoError(t, token.SetScopes([]string{"deployment:read"}))
		}
		tokens = append(tokens, token)
	}
	require.NoError(t, db.CreateInBatches(tokens, 100).Error)
	for index, scopes := range []string{`[ "model:write" ]`, `malformed-grant`} {
		require.NoError(t, db.Create(&UserAccessToken{Id: userAccessTokenCleanupBatchSize + 2 + index, TokenHash: fmt.Sprintf("untouched-%d", index), Scopes: scopes}).Error)
	}
	var before []UserAccessToken
	require.NoError(t, db.Order("id").Find(&before).Error)
	for range 2 {
		require.NoError(t, purgeRemovedFeatureTokenScopes(db))
		var after []UserAccessToken
		require.NoError(t, db.Order("id").Find(&after).Error)
		require.Len(t, after, len(before))
		for index, token := range after {
			if index > userAccessTokenCleanupBatchSize {
				require.Equal(t, before[index], token)
				continue
			}
			expected := []string{}
			if index%2 == 0 {
				expected = []string{"model:read"}
			}
			require.Equal(t, expected, token.GetScopes())
			token.Scopes = before[index].Scopes
			require.Equal(t, before[index], token)
		}
	}
}

func TestRetiredSidebarSectionIsPurgedWithoutChangingOtherSettings(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "sidebar.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	previousDB, previousMap := DB, common.OptionMap
	DB, common.OptionMap = db, map[string]string{}
	t.Cleanup(func() { DB, common.OptionMap = previousDB, previousMap })
	require.NoError(t, db.AutoMigrate(&User{}, &Option{}))
	const originalSidebar = `{"chat":{"enabled":true,"playground":true,"chat":true},"console":{"token":false},"custom":{"keep":true}}`
	const expectedSidebar = `{"console":{"token":false},"custom":{"keep":true}}`
	const originalSetting = `{"language":"en","notify_type":"email","sidebar_modules":"{\"chat\":{\"enabled\":true},\"console\":{\"token\":false}}","future_setting":{"large":9007199254740993}}`
	user := User{Username: "sidebar-user", Setting: originalSetting}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&Option{Key: "SidebarModulesAdmin", Value: originalSidebar}).Error)
	for range 2 {
		require.NoError(t, purgeRemovedFeatureOptions(db))
		require.NoError(t, purgeRemovedFeatureUserSettings(db))
	}
	var stored Option
	require.NoError(t, db.First(&stored, "key = ?", "SidebarModulesAdmin").Error)
	require.JSONEq(t, expectedSidebar, stored.Value)
	require.NoError(t, db.First(&user, user.Id).Error)
	require.Contains(t, user.Setting, "9007199254740993")
	require.JSONEq(t, `{"language":"en","notify_type":"email","sidebar_modules":"{\"console\":{\"token\":false}}","future_setting":{"large":9007199254740993}}`, user.Setting)
	require.Equal(t, "invalid legacy value", CleanSidebarModules("invalid legacy value"))
	require.NoError(t, UpdateOption("SidebarModulesAdmin", originalSidebar))
	require.JSONEq(t, expectedSidebar, common.OptionMap["SidebarModulesAdmin"])
	require.NoError(t, UpdateOptionsBulk(map[string]string{"SidebarModulesAdmin": originalSidebar}))
	require.NoError(t, db.First(&stored, "key = ?", "SidebarModulesAdmin").Error)
	require.JSONEq(t, expectedSidebar, stored.Value)
}
