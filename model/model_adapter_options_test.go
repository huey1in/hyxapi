package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestModelAdapterOptionsValidateBeforeSingleAndBulkPersistence(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "model-options.db")), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	previousDB, previousMap := DB, common.OptionMap
	claude, gemini := model_setting.GetClaudeSettings(), model_setting.GetGeminiSettings()
	previousClaude, previousGemini := claude.DefaultMaxTokens, gemini.SafetySettings
	previousWorker := system_setting.WorkerSettingsSnapshot()
	previousTaskAddress := system_setting.TaskPublicAddress
	DB, common.OptionMap = db, map[string]string{}
	t.Cleanup(func() {
		DB, common.OptionMap = previousDB, previousMap
		claude.DefaultMaxTokens, gemini.SafetySettings = previousClaude, previousGemini
		system_setting.WorkerUrl, system_setting.WorkerValidKey, system_setting.WorkerAllowHttpImageRequestEnabled = previousWorker.URL, previousWorker.Key, previousWorker.AllowHTTP
		system_setting.TaskPublicAddress = previousTaskAddress
	})
	require.NoError(t, db.AutoMigrate(&Option{}))
	require.NoError(t, UpdateOption("claude.default_max_tokens", `{"default":0}`))
	require.NoError(t, UpdateOption("gemini.safety_settings", `{"default":"OFF"}`))
	require.NoError(t, UpdateOptionsBulk(map[string]string{"WorkerUrl": "https://worker.example/download", "WorkerValidKey": "fixture-key", "WorkerAllowHttpImageRequestEnabled": "false", "TaskPublicAddress": "https://tasks.example"}))
	require.Equal(t, "https://worker.example/download", system_setting.WorkerSettingsSnapshot().URL)
	require.Equal(t, "fixture-key", system_setting.WorkerSettingsSnapshot().Key)
	require.False(t, system_setting.WorkerSettingsSnapshot().AllowHTTP)
	require.Equal(t, "https://tasks.example", system_setting.TaskPublicAddress)
	var before []Option
	require.NoError(t, db.Order("key").Find(&before).Error)
	for key, values := range map[string][]string{
		"claude.default_max_tokens":          {`null`, `[]`, `{"default":-1}`, `{"default":1.5}`, `{"default":"8192"}`},
		"gemini.safety_settings":             {`null`, `[]`, `{"default":"BLOCK_SOME"}`, `{"default":1}`},
		"WorkerUrl":                          {" ", "worker.example", "ftp://worker.example", "https://user:secret@worker.example", "https://worker.example/#fragment", "https://worker.example\n"},
		"WorkerAllowHttpImageRequestEnabled": {"1", "yes", ""},
	} {
		for _, value := range values {
			require.Error(t, UpdateOption(key, value), "%s: %s", key, value)
			require.Error(t, UpdateOptionsBulk(map[string]string{key: value, "unrelated_model_probe": "must not persist"}))
			var after []Option
			require.NoError(t, db.Order("key").Find(&after).Error)
			require.Equal(t, before, after)
			require.NotContains(t, common.OptionMap, "unrelated_model_probe")
			require.Zero(t, claude.GetDefaultMaxTokens("default"))
			require.Equal(t, "OFF", model_setting.GetGeminiSafetySetting("default"))
		}
	}
}
