package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNotificationSettingsPreservePreferencesAndEnforceAdminCategories(t *testing.T) {
	disabled := false
	previous := dto.UserSetting{Language: "en", SidebarModules: "saved", BillingPreference: "wallet_only", QuotaWarningEnabled: &disabled}
	patch := map[string]interface{}{"notify_type": "email", "channel_notify_enabled": true, "upstream_model_update_notify_enabled": true}
	user, err := applyNotificationSettings(previous, patch, common.RoleCommonUser)
	require.NoError(t, err)
	require.Equal(t, "en", user.Language)
	require.Equal(t, "saved", user.SidebarModules)
	require.Equal(t, "wallet_only", user.BillingPreference)
	require.NotNil(t, user.QuotaWarningEnabled)
	require.False(t, *user.QuotaWarningEnabled)
	require.Nil(t, user.ChannelNotifyEnabled)
	require.False(t, user.UpstreamModelUpdateNotifyEnabled)
	admin, err := applyNotificationSettings(previous, patch, common.RoleAdminUser)
	require.NoError(t, err)
	require.True(t, *admin.ChannelNotifyEnabled)
	require.True(t, admin.UpstreamModelUpdateNotifyEnabled)
}

func TestNotificationSettingsRejectInvalidFields(t *testing.T) {
	for _, value := range []any{
		"email", map[string]interface{}{"quota_warning_threshold": -1},
		map[string]interface{}{"quota_warning_enabled": "false"},
		map[string]interface{}{"notify_type": "unknown"},
		map[string]interface{}{"webhook_url": "file:///tmp/test"},
		map[string]interface{}{"gotify_priority": 11},
		map[string]interface{}{"notification_email": "invalid"},
	} {
		_, err := applyNotificationSettings(dto.UserSetting{}, value, common.RoleAdminUser)
		require.Error(t, err)
	}
}
