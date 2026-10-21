package system_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type TwoFASettings struct {
	Enabled bool `json:"enabled"`
}

var defaultTwoFASettings = TwoFASettings{}

func init() {
	config.GlobalConfig.Register("twofa", &defaultTwoFASettings)
}

func GetTwoFASettings() *TwoFASettings {
	return &defaultTwoFASettings
}

// IsTwoFAEnabled controls enrollment and client settings. Existing enrolled
// factors remain required for authentication when enrollment is disabled.
func IsTwoFAEnabled() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return defaultTwoFASettings.Enabled
}
