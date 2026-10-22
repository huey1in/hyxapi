package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestSettingsCannotChangeSetupServerAddress(t *testing.T) {
	_, identity := setupSecurityEnrollmentTest(t)
	setupPasskeyDomainOptions(t)
	const address = "https://example.com"
	require.NoError(t, model.UpdateOption("ServerAddress", address))
	assertAddressUnchanged := func() {
		t.Helper()
		var option model.Option
		require.NoError(t, model.DB.Where(&model.Option{Key: "ServerAddress"}).First(&option).Error)
		require.Equal(t, address, option.Value)
		require.Equal(t, address, system_setting.ServerAddress)
		common.OptionMapRWMutex.RLock()
		cached := common.OptionMap["ServerAddress"]
		common.OptionMapRWMutex.RUnlock()
		require.Equal(t, address, cached)
	}

	response := securityEnrollmentRequest(http.MethodGet, "/api/option/", "", "", identity, GetOptions)
	var options struct {
		Success bool
		Data    []model.Option
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &options))
	require.True(t, options.Success)
	for _, option := range options.Data {
		require.NotEqual(t, "ServerAddress", option.Key)
	}

	response = securityEnrollmentRequest(http.MethodPut, "/api/option/", `{"key":"ServerAddress","value":"https://changed.example"}`, "", identity, UpdateOption)
	require.Equal(t, http.StatusBadRequest, response.Code)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.False(t, result.Success)
	assertAddressUnchanged()

	// Older clients may still send this field alongside Passkey settings.
	// Neither a preview nor a save can replace the setup-detected address.
	const origins = "https://example.com,https://login.example.com"
	for _, preview := range []bool{true, false} {
		response = passkeyDomainRequest(t, "/api/option/passkey/domains", map[string]any{
			"rp_id": "example.com", "legacy_rp_ids": "", "origins": origins,
			"server_address": "https://changed.example", "preview": preview,
		}, identity, address, UpdatePasskeyDomains)
		require.Equal(t, http.StatusOK, response.Code)
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
		assertAddressUnchanged()
		if preview {
			require.Equal(t, "https://example.com", system_setting.PasskeySettingsSnapshot().Origins)
		}
	}
	require.Equal(t, origins, system_setting.PasskeySettingsSnapshot().Origins)
}
