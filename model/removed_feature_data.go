package model

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrRemovedFeatureOption = errors.New("this feature setting has been removed")

// IsRemovedFeatureOption prevents obsolete settings from being restored by old clients.
func IsRemovedFeatureOption(key string) bool {
	return key == "Chats" || key == "ChatLink" || key == "ChatLink2" || key == "log_setting.max_range_days" || strings.HasPrefix(key, "model_deployment.")
}

func purgeRemovedFeatureOptions(db *gorm.DB) error {
	var options []Option
	if err := db.Find(&options).Error; err != nil {
		return err
	}
	var keys []interface{}
	for _, option := range options {
		if IsRemovedFeatureOption(option.Key) {
			keys = append(keys, option.Key)
		} else if option.Key == "SidebarModulesAdmin" {
			cleaned := CleanSidebarModules(option.Value)
			if cleaned != option.Value {
				if err := db.Model(&Option{}).Where(clause.Eq{Column: clause.Column{Name: "key"}, Value: option.Key}).
					Where("value = ?", option.Value).Update("value", cleaned).Error; err != nil {
					return err
				}
			}
		}
	}
	if len(keys) == 0 {
		return nil
	}
	return db.Where(clause.IN{Column: clause.Column{Name: "key"}, Values: keys}).Delete(&Option{}).Error
}

// CleanSidebarModules drops retired sections while preserving unrelated preferences.
func CleanSidebarModules(raw string) string {
	var modules map[string]json.RawMessage
	if common.UnmarshalJsonStr(raw, &modules) != nil || modules == nil {
		return raw
	}
	if _, exists := modules["chat"]; !exists {
		return raw
	}
	delete(modules, "chat")
	encoded, err := common.Marshal(modules)
	if err != nil {
		return raw
	}
	return string(encoded)
}

func purgeRemovedFeatureUserSettings(db *gorm.DB) error {
	var users []User
	return db.Select("id", "setting").FindInBatches(&users, userAccessTokenCleanupBatchSize, func(_ *gorm.DB, _ int) error {
		for _, user := range users {
			var settings map[string]json.RawMessage
			if common.UnmarshalJsonStr(user.Setting, &settings) != nil || settings == nil {
				continue
			}
			var sidebar string
			if json.Unmarshal(settings["sidebar_modules"], &sidebar) != nil {
				continue
			}
			cleaned := CleanSidebarModules(sidebar)
			if cleaned == sidebar {
				continue
			}
			settings["sidebar_modules"], _ = common.Marshal(cleaned)
			encoded, err := common.Marshal(settings)
			if err != nil {
				return err
			}
			if err := db.Model(&User{}).Where("id = ? AND setting = ?", user.Id, user.Setting).Update("setting", string(encoded)).Error; err != nil {
				return err
			}
		}
		return nil
	}).Error
}

func purgeRemovedFeatureTokenScopes(db *gorm.DB) error {
	var tokens []UserAccessToken
	return db.Select("id", "scopes").FindInBatches(&tokens, userAccessTokenCleanupBatchSize, func(_ *gorm.DB, _ int) error {
		for _, token := range tokens {
			var scopes []string
			if err := common.UnmarshalJsonStr(token.Scopes, &scopes); err != nil {
				continue // Malformed grants already authorize nothing.
			}
			active := make([]string, 0, len(scopes))
			for _, scope := range scopes {
				if !strings.HasPrefix(scope, "deployment:") {
					active = append(active, scope)
				}
			}
			if len(active) == len(scopes) {
				continue
			}
			encoded, err := common.Marshal(active)
			if err != nil {
				return err
			}
			if err := db.Model(&UserAccessToken{}).Where("id = ? AND scopes = ?", token.Id, token.Scopes).
				Update("scopes", string(encoded)).Error; err != nil {
				return err
			}
		}
		return nil
	}).Error
}
