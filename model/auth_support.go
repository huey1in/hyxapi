package model

import (
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"strings"
)

var ErrWalletQuotaLimitExceeded error = common.NewMessage("Wallet quota limit exceeded")

func validateOptionValue(key, value string) error {
	consoleTypes := map[string]string{
		"console_setting.api_info":           "ApiInfo",
		"console_setting.faq":                "FAQ",
		"console_setting.announcements":      "Announcements",
		"console_setting.uptime_kuma_groups": "UptimeKumaGroups",
	}
	if settingType, ok := consoleTypes[key]; ok {
		return console_setting.ValidateConsoleSettings(value, settingType)
	}
	switch key {
	case "claude.default_max_tokens":
		return model_setting.ValidateClaudeDefaultMaxTokens(value)
	case "gemini.safety_settings":
		return model_setting.ValidateGeminiSafetySettings(value)
	case "WorkerUrl", "WorkerAllowHttpImageRequestEnabled":
		return system_setting.ValidateWorkerOption(key, value)
	case "console_setting.api_info_enabled", "console_setting.faq_enabled", "console_setting.announcements_enabled", "console_setting.uptime_kuma_enabled":
		if value != "true" && value != "false" {
			return fmt.Errorf("console panel enabled must be true or false")
		}
	case "GroupRatio", "group_ratio_setting.group_ratio":
		return ratio_setting.CheckGroupRatio(value)
	case "GroupGroupRatio", "group_ratio_setting.group_group_ratio":
		return ratio_setting.ValidateGroupGroupRatio(value)
	case "group_ratio_setting.group_special_usable_group":
		return ratio_setting.ValidateGroupSpecialUsableGroups(value)
	case "model_deployment.ionet.enabled":
		if value != "true" && value != "false" {
			return fmt.Errorf("deployment enabled must be true or false")
		}
	case "model_deployment.ionet.api_key":
		if strings.ContainsAny(value, "\r\n") || len(value) > 8192 {
			return fmt.Errorf("invalid io.net API key")
		}
	case "Chats":
		return setting.ValidateChatsJSON(value)
	case "MaxTokenAutoGroups":
		return setting.ValidateMaxTokenAutoGroups(value)
	case "AutoGroups":
		var groups []string
		return common.UnmarshalJsonStr(value, &groups)
	}
	if key == legacyAccessTokenRetireAtKey {
		return errLegacyRetireAtReadOnly
	}
	if err := operation_setting.ValidateQuotaOption(key, value); err != nil {
		return err
	}
	if key == operation_setting.ToolPriceOptionKey {
		return operation_setting.ValidateToolPricesJSON(value)
	}
	if IsRemovedModelPricingOption(key) {
		return ErrRemovedModelPricingOption
	}
	return nil
}
