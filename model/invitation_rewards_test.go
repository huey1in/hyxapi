package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRegistrationInvitationRewardsRespectFeatureSwitch(t *testing.T) {
	payment := operation_setting.GetPaymentSetting()
	previousPayment := *payment
	previousNew, previousInviter, previousInvitee := common.QuotaForNewUser, common.QuotaForInviter, common.QuotaForInvitee
	common.QuotaForNewUser, common.QuotaForInviter, common.QuotaForInvitee = 40, 100, 25
	t.Cleanup(func() {
		*payment = previousPayment
		common.QuotaForNewUser, common.QuotaForInviter, common.QuotaForInvitee = previousNew, previousInviter, previousInvitee
	})

	for _, flow := range []string{"password", "oauth"} {
		for _, fixture := range []struct {
			name     string
			enabled  bool
			credited bool
		}{
			{"default disabled", false, false},
			{"enabled", true, true},
		} {
			t.Run(flow+"/"+fixture.name, func(t *testing.T) {
				truncateTables(t)
				*payment = operation_setting.PaymentSetting{
					InvitationRewardsEnabled: fixture.enabled,
				}
				inviter := &User{Username: "reward-inviter", Quota: 1000, AffQuota: 200, AffHistoryQuota: 300, AffCount: 3}
				require.NoError(t, DB.Create(inviter).Error)
				invitee := &User{Username: "reward-invitee", Password: "invitation-test-password", InviterId: inviter.Id}
				if flow == "password" {
					require.NoError(t, invitee.Insert(inviter.Id))
				} else {
					require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return invitee.InsertWithTx(tx, inviter.Id) }))
					invitee.FinalizeOAuthUserCreation(inviter.Id)
				}
				var storedInviter, storedInvitee User
				require.NoError(t, DB.First(&storedInviter, inviter.Id).Error)
				require.NoError(t, DB.First(&storedInvitee, invitee.Id).Error)
				if fixture.credited {
					require.Equal(t, 65, storedInvitee.Quota)
					require.Equal(t, 300, storedInviter.AffQuota)
					require.Equal(t, 400, storedInviter.AffHistoryQuota)
					require.Equal(t, 4, storedInviter.AffCount)
				} else {
					require.Equal(t, 40, storedInvitee.Quota)
					require.Equal(t, 200, storedInviter.AffQuota, "disabling rewards preserves existing credits")
					require.Equal(t, 300, storedInviter.AffHistoryQuota)
					require.Equal(t, 3, storedInviter.AffCount)
				}
				require.Equal(t, 1000, storedInviter.Quota)
			})
		}
	}
}

func TestInvitationRewardsOptionPersistsAndRejectsInvalidValues(t *testing.T) {
	truncateTables(t)
	payment := operation_setting.GetPaymentSetting()
	previousPayment, previousOptions := *payment, common.OptionMap
	*payment = operation_setting.PaymentSetting{}
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { *payment = previousPayment; common.OptionMap = previousOptions })
	const key = "payment_setting.invitation_rewards_enabled"
	require.Equal(t, "false", config.GlobalConfig.ExportAllConfigs()[key])
	require.NoError(t, UpdateOption(key, "true"))
	require.True(t, payment.InvitationRewardsEnabled)
	payment.InvitationRewardsEnabled = false
	loadOptionsFromDatabase()
	require.True(t, payment.InvitationRewardsEnabled, "saved opt-in survives configuration reload")
	for _, value := range []string{"", "yes", "1", "TRUE"} {
		require.Error(t, UpdateOption(key, value))
	}
	var stored Option
	require.NoError(t, DB.First(&stored, "key = ?", key).Error)
	require.Equal(t, "true", stored.Value)
	require.True(t, payment.InvitationRewardsEnabled)
	require.NoError(t, UpdateOption(key, "false"))
	require.False(t, payment.InvitationRewardsEnabled)
}
