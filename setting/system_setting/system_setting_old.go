package system_setting

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

var ServerAddress = "http://localhost:3000"
var WorkerUrl = ""
var WorkerValidKey = ""
var WorkerAllowHttpImageRequestEnabled = false

type WorkerSettings struct {
	URL       string
	Key       string
	AllowHTTP bool
}

func WorkerSettingsSnapshot() WorkerSettings {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return WorkerSettings{URL: strings.TrimSpace(WorkerUrl), Key: WorkerValidKey, AllowHTTP: WorkerAllowHttpImageRequestEnabled}
}

func ValidateWorkerOption(key, value string) error {
	switch key {
	case "WorkerUrl":
		if value == "" {
			return nil
		}
		parsed, err := url.Parse(value)
		if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil || parsed.Fragment != "" || strings.ContainsAny(value, " \t\r\n") {
			return fmt.Errorf("Worker URL must be an HTTP or HTTPS URL without credentials or fragments")
		}
	case "WorkerAllowHttpImageRequestEnabled":
		if value != "true" && value != "false" {
			return fmt.Errorf("Worker HTTP access must be true or false")
		}
	}
	return nil
}
