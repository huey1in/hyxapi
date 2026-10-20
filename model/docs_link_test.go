package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDocumentationOptionPersistsAndRejectsUnsafeReplacement(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "docs.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&Option{}))
	previousDB := DB
	DB = db
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	previousLink := operation_setting.GetGeneralSetting().DocsLink
	t.Cleanup(func() {
		DB = previousDB
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		operation_setting.GetGeneralSetting().DocsLink = previousLink
	})
	require.NoError(t, UpdateOption("general_setting.docs_link", " https://example.test/docs "))
	require.Equal(t, "https://example.test/docs", operation_setting.GetGeneralSetting().DocsLink)
	require.Error(t, UpdateOption("general_setting.docs_link", "javascript:alert(1)"))
	var saved Option
	require.NoError(t, db.First(&saved, "key = ?", "general_setting.docs_link").Error)
	require.Equal(t, "https://example.test/docs", saved.Value)
	require.Error(t, UpdateOptionsBulk(map[string]string{"general_setting.docs_link": "javascript:alert(1)", "About": "must not be saved"}))
	var count int64
	require.NoError(t, db.Model(&Option{}).Where("key = ?", "About").Count(&count).Error)
	require.Zero(t, count)
	require.NoError(t, UpdateOptionsBulk(map[string]string{"general_setting.docs_link": " https://example.test/help "}))
	require.Equal(t, "https://example.test/help", operation_setting.GetGeneralSetting().DocsLink)
	require.NoError(t, UpdateOption("general_setting.docs_link", ""))
	require.Empty(t, operation_setting.GetGeneralSetting().DocsLink)
}
