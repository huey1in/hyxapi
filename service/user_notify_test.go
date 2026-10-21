package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestQuotaReminderOnlyOnThresholdCrossing(t *testing.T) {
	previousEnabled, previousThreshold := common.QuotaRemindEnabled, common.QuotaRemindThreshold
	t.Cleanup(func() { common.QuotaRemindEnabled, common.QuotaRemindThreshold = previousEnabled, previousThreshold })
	common.QuotaRemindEnabled, common.QuotaRemindThreshold = true, 100
	settings := dto.UserSetting{}
	for _, step := range []struct {
		before, after int64
		due           bool
	}{
		{120, 100, false}, {100, 99, true}, {99, 80, false}, {80, 130, false}, {130, 90, true},
	} {
		require.Equal(t, step.due, quotaReminderDue(settings, step.before, step.after))
	}
	settings.QuotaWarningThreshold = 50
	require.False(t, quotaReminderDue(settings, 100, 60))
	require.True(t, quotaReminderDue(settings, 60, 49))
	disabled := false
	settings.QuotaWarningEnabled = &disabled
	require.False(t, quotaReminderDue(settings, 60, 49))
	settings.QuotaWarningEnabled = nil
	common.QuotaRemindEnabled = false
	require.False(t, quotaReminderDue(settings, 60, 49))
}

func TestChannelNotificationDefaultsAndOptIn(t *testing.T) {
	require.True(t, receivesChannelNotifications(common.RoleRootUser, dto.UserSetting{}))
	require.False(t, receivesChannelNotifications(common.RoleAdminUser, dto.UserSetting{}))
	enabled, disabled := true, false
	require.True(t, receivesChannelNotifications(common.RoleAdminUser, dto.UserSetting{ChannelNotifyEnabled: &enabled}))
	require.False(t, receivesChannelNotifications(common.RoleRootUser, dto.UserSetting{ChannelNotifyEnabled: &disabled}))
	require.False(t, receivesChannelNotifications(common.RoleCommonUser, dto.UserSetting{ChannelNotifyEnabled: &enabled}))
}

func TestQuotaNotificationUsesSavedLanguageAndCurrentSite(t *testing.T) {
	require.NoError(t, i18n.Init())
	text, values := quotaNotifyContent("en", dto.NotifyTypeEmail, "Low balance", "$1")
	require.Contains(t, text, "Low balance")
	require.Contains(t, text, "/topup")
	require.Len(t, values, 4)
	plain, values := quotaNotifyContent("zh-CN", dto.NotifyTypeGotify, "余额提醒", "$1")
	require.Contains(t, plain, "余额")
	require.NotContains(t, plain, "<a")
	require.Len(t, values, 2)
}
