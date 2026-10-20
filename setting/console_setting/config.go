package console_setting

import "github.com/QuantumNous/new-api/setting/config"

type ConsoleSetting struct {
	ApiInfo              string `json:"api_info"`
	FAQ                  string `json:"faq"`
	ApiInfoEnabled       bool   `json:"api_info_enabled"`
	FAQEnabled           bool   `json:"faq_enabled"`
	UptimeKumaGroups     string `json:"uptime_kuma_groups"`    // Uptime Kuma 分组配置 (JSON 数组字符串)
	Announcements        string `json:"announcements"`         // 系统公告 (JSON 数组字符串)
	UptimeKumaEnabled    bool   `json:"uptime_kuma_enabled"`   // 是否启用 Uptime Kuma 面板
	AnnouncementsEnabled bool   `json:"announcements_enabled"` // 是否启用系统公告面板
}

// 默认配置
var defaultConsoleSetting = ConsoleSetting{
	ApiInfoEnabled:       true,
	FAQEnabled:           true,
	UptimeKumaGroups:     "",
	Announcements:        "",
	UptimeKumaEnabled:    true,
	AnnouncementsEnabled: true,
}

// 全局实例
var consoleSetting = defaultConsoleSetting

func init() {
	// 注册到全局配置管理器，键名为 console_setting
	config.GlobalConfig.Register("console_setting", &consoleSetting)
}

// GetConsoleSetting 获取 ConsoleSetting 配置实例
func GetConsoleSetting() *ConsoleSetting {
	return &consoleSetting
}
