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
	switch key {
	case "About", "Chats", "ChatLink", "ChatLink2", "log_setting.max_range_days", "DisplayInCurrencyEnabled",
		"group_ratio_setting.group_ratio", "group_ratio_setting.group_group_ratio",
		"LegacyAccessTokenRetireAt", "theme.frontend", "Announcements", "UptimeKumaUrl", "UptimeKumaSlug",
		"monitor_setting.model_health_enabled", "monitor_setting.model_health_interval_minutes",
		"ApiInfo", "FAQ", "console_setting.api_info", "console_setting.faq",
		"console_setting.api_info_enabled", "console_setting.faq_enabled", "general_setting.docs_link",
		"payment_setting.compliance_confirmed", "payment_setting.compliance_terms_version",
		"payment_setting.compliance_confirmed_at", "payment_setting.compliance_confirmed_by", "payment_setting.compliance_confirmed_ip":
		return true
	}
	return strings.HasPrefix(key, "model_deployment.")
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
		} else if option.Key == "SidebarModulesAdmin" || option.Key == "HeaderNavModules" {
			cleaned := option.Value
			if option.Key == "SidebarModulesAdmin" {
				cleaned = CleanSidebarModules(option.Value)
			} else {
				cleaned = CleanHeaderNavModules(option.Value)
			}
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

// CleanHeaderNavModules removes retired public navigation without changing other settings.
func CleanHeaderNavModules(raw string) string {
	var modules map[string]json.RawMessage
	if common.UnmarshalJsonStr(raw, &modules) != nil || modules == nil {
		return raw
	}
	changed := false
	for _, key := range []string{"rankings", "about", "docs"} {
		if _, exists := modules[key]; exists {
			delete(modules, key)
			changed = true
		}
	}
	if !changed {
		return raw
	}
	encoded, err := common.Marshal(modules)
	if err != nil {
		return raw
	}
	return string(encoded)
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
	return db.Unscoped().Select("id", "setting").FindInBatches(&users, userAccessTokenCleanupBatchSize, func(_ *gorm.DB, _ int) error {
		for _, user := range users {
			var settings map[string]json.RawMessage
			if common.UnmarshalJsonStr(user.Setting, &settings) != nil || settings == nil {
				continue
			}
			if _, exists := settings["sidebar_modules"]; !exists {
				continue
			}
			delete(settings, "sidebar_modules")
			encoded, err := common.Marshal(settings)
			if err != nil {
				return err
			}
			if err := db.Unscoped().Model(&User{}).Where("id = ? AND setting = ?", user.Id, user.Setting).Update("setting", string(encoded)).Error; err != nil {
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
