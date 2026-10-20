package log_setting

import "github.com/QuantumNous/new-api/setting/config"

type LogSetting struct {
	LogRequestBody    bool `json:"log_request_body"`
	LogResponseBody   bool `json:"log_response_body"`
	MaxBodyLogBytes   int  `json:"max_body_log_bytes"`
	UserExportEnabled bool `json:"user_export_enabled"`
}

var logSetting = LogSetting{
	LogRequestBody:    false,
	LogResponseBody:   false,
	MaxBodyLogBytes:   4096,
	UserExportEnabled: true,
}

func init() {
	config.GlobalConfig.Register("log_setting", &logSetting)
}

func GetSetting() *LogSetting {
	return &logSetting
}
