package system_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type GoogleSettings struct {
	Enabled      bool   `json:"enabled"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

var googleSettings GoogleSettings

func init() {
	config.GlobalConfig.Register("google", &googleSettings)
}

func GetGoogleSettings() *GoogleSettings { return &googleSettings }

func (s *GoogleSettings) IsConfigured() bool {
	return strings.TrimSpace(s.ClientID) != "" && strings.TrimSpace(s.ClientSecret) != ""
}
