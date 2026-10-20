package controller

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
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

func TestUserSettingsHTTPPartialPatchPreservesOtherPreferences(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	initial := dto.UserSetting{NotifyType: "email", Language: "fr", SidebarModules: "saved", BillingPreference: "wallet_only", RecordIpLog: true, AcceptUnsetRatioModel: true}
	require.NoError(t, model.UpdateUserSetting(user.Id, initial))
	for _, body := range []string{`{"quota_warning_threshold":123}`, `{"notify_type":"email","notification_email":"notice@example.com"}`} {
		response := securityEnrollmentRequest("PUT", "/api/user/setting", body, "", identity, UpdateUserSetting)
		var result struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.True(t, result.Success, response.Body.String())
	}
	current, err := model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	require.True(t, current.RecordIpLog)
	require.True(t, current.AcceptUnsetRatioModel)
	require.Equal(t, "fr", current.Language)
	require.Equal(t, "saved", current.SidebarModules)
	require.Equal(t, "wallet_only", current.BillingPreference)
	require.Equal(t, float64(123), current.QuotaWarningThreshold)
	response := securityEnrollmentRequest("PUT", "/api/user/setting", `{"record_ip_log":false,"accept_unset_model_ratio_model":false}`, "", identity, UpdateUserSetting)
	require.Contains(t, response.Body.String(), `"success":true`)
	current, err = model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	require.False(t, current.RecordIpLog)
	require.False(t, current.AcceptUnsetRatioModel)
	require.Equal(t, "notice@example.com", current.NotificationEmail)
	response = securityEnrollmentRequest("PUT", "/api/user/setting", `{"notify_type":"webhook","quota_warning_threshold":999}`, "", identity, UpdateUserSetting)
	require.Contains(t, response.Body.String(), `"success":false`)
	current, err = model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	require.Equal(t, "email", current.NotifyType)
	require.Equal(t, float64(123), current.QuotaWarningThreshold)
}

func TestConcurrentPersonalSettingsFormsMergeLatestRow(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	type operation struct {
		handler gin.HandlerFunc
		body    string
	}
	operations := []operation{
		{UpdateSelf, `{"language":"ja"}`},
		{UpdateSelf, `{"sidebar_modules":"{\"console\":{\"enabled\":false}}"}`},
		{UpdateSubscriptionPreference, `{"billing_preference":"wallet_only"}`},
		{UpdateUserSetting, `{"record_ip_log":true,"quota_warning_threshold":456}`},
	}
	var group sync.WaitGroup
	start := make(chan struct{})
	results := make(chan bool, len(operations))
	for _, item := range operations {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			response := securityEnrollmentRequest("PUT", "/settings", item.body, "", identity, item.handler)
			var result struct {
				Success bool `json:"success"`
			}
			results <- common.Unmarshal(response.Body.Bytes(), &result) == nil && result.Success
		}()
	}
	close(start)
	group.Wait()
	close(results)
	for success := range results {
		require.True(t, success)
	}
	current, err := model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	require.Equal(t, "ja", current.Language)
	require.Equal(t, `{"console":{"enabled":false}}`, current.SidebarModules)
	require.Equal(t, "wallet_only", current.BillingPreference)
	require.True(t, current.RecordIpLog)
	require.Equal(t, float64(456), current.QuotaWarningThreshold)
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
