package system_setting

import (
	"errors"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

type USDTSettings struct {
	Enabled    bool   `json:"enabled"`
	GatewayURL string `json:"gateway_url"`
	MerchantID string `json:"merchant_id"`
	APIKey     string `json:"api_key"`
	Network    string `json:"network"`
	MinTopUp   int64  `json:"min_topup"`
}

var usdtSettings = USDTSettings{Network: "tron", MinTopUp: 5}

func init()                          { config.GlobalConfig.Register("usdt", &usdtSettings) }
func GetUSDTSettings() *USDTSettings { return &usdtSettings }

func (s USDTSettings) Validate() error {
	u, err := url.Parse(s.GatewayURL)
	if err != nil || u.Host == "" || u.Scheme != "https" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("USDT gateway must use an HTTPS URL")
	}
	if strings.TrimSpace(s.MerchantID) == "" || strings.TrimSpace(s.APIKey) == "" || s.MinTopUp < 1 {
		return errors.New("USDT gateway credentials and minimum are required")
	}
	switch s.Network {
	case "tron", "ethereum", "bsc", "polygon", "solana", "arbitrum", "base", "plasma":
	default:
		return errors.New("Unsupported USDT network")
	}
	return nil
}
