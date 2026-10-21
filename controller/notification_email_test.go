package controller

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestNotificationEmailVerificationAndDelivery(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	previousLimit := constant.NotifyLimitCount
	constant.NotifyLimitCount = 100
	t.Cleanup(func() { constant.NotifyLimitCount = previousLimit })
	mailbox := newSecurityMailbox(t)
	user.Email = "unverified@example.com"
	require.NoError(t, model.DB.Model(user).Update("email", user.Email).Error)
	initial := dto.UserSetting{Language: "en", BillingPreference: "wallet_only", NotificationEmail: "legacy@example.com", QuotaWarningThreshold: 123}
	require.NoError(t, model.UpdateUserSetting(user.Id, initial))
	// Neither an old custom address nor the account fallback can receive mail
	// until ownership has been verified by the dedicated flow.
	assert.ErrorIs(t, service.NotifyUser(user.Id, initial, dto.NewNotify("notification-email-test", "Test", "Test", nil)), model.ErrNotificationEmailUnverified)
	response := securityEnrollmentRequest("POST", "/api/user/notification_email/start", `{"email":"New@Example.com"}`, "", identity, NotificationEmailStart)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	var data service.NotificationEmailData
	require.NoError(t, common.Unmarshal(result.Data, &data))
	require.Equal(t, "new@example.com", data.Email)
	code := mailbox.code(t, data.Email)
	flow, err := model.GetAuthFlow(data.FlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeNotificationEmail})
	require.NoError(t, err)
	assert.NotContains(t, flow.Payload, code)
	current, err := model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "legacy@example.com", current.NotificationEmail)
	assert.False(t, current.NotificationEmailVerified)
	assert.ErrorIs(t, model.CompleteNotificationEmailVerification(identity, data.FlowToken, "invalid"), model.ErrEmailBindingCodeInvalid)
	response = securityEnrollmentRequest("POST", "/api/user/notification_email/confirm", `{"flow_token":"`+data.FlowToken+`","code":"`+code+`"}`, "", identity, NotificationEmailConfirm)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	current, err = model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	assert.Equal(t, data.Email, current.NotificationEmail)
	assert.True(t, current.NotificationEmailVerified)
	assert.Equal(t, initial.Language, current.Language)
	assert.Equal(t, initial.BillingPreference, current.BillingPreference)
	assert.Equal(t, initial.QuotaWarningThreshold, current.QuotaWarningThreshold)
	stored, err := model.GetUserById(user.Id, false)
	require.NoError(t, err)
	assert.Equal(t, user.Email, stored.Email, "notification verification must not change sign-in email")
	require.NoError(t, service.NotifyUser(user.Id, current, dto.NewNotify("notification-email-test", "Verified notification", "Test", nil)))
	mailbox.mutex.Lock()
	assert.Len(t, mailbox.mail[data.Email], 2, "only the verification message and verified notification are delivered")
	assert.Empty(t, mailbox.mail["legacy@example.com"])
	assert.Empty(t, mailbox.mail["unverified@example.com"])
	mailbox.mutex.Unlock()
	assert.ErrorIs(t, model.CompleteNotificationEmailVerification(identity, data.FlowToken, code), model.ErrAuthFlowConsumed)
	var logs []model.AuditLog
	require.NoError(t, model.LOG_DB.Find(&logs).Error)
	encoded, err := common.Marshal(logs)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), code)
	assert.NotContains(t, string(encoded), data.FlowToken)
}

func TestNotificationEmailSettingsCannotBypassVerification(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	for _, settings := range []dto.UserSetting{{}, {NotificationEmail: "owned@example.com", NotificationEmailVerified: true}} {
		require.NoError(t, model.UpdateUserSetting(user.Id, settings))
		for _, body := range []string{
			`{"notification_email":"victim@example.com"}`,
			`{"notification_email":"victim@example.com","notification_email_verified":true}`,
		} {
			response := securityEnrollmentRequest("PUT", "/api/user/setting", body, "", identity, UpdateUserSetting)
			assert.Contains(t, response.Body.String(), `"success":false`)
			current, err := model.GetUserSetting(user.Id, true)
			require.NoError(t, err)
			assert.Equal(t, settings.NotificationEmail, current.NotificationEmail)
			assert.Equal(t, settings.NotificationEmailVerified, current.NotificationEmailVerified)
		}
	}
	response := securityEnrollmentRequest("PUT", "/api/user/setting", `{"notification_email":"","notification_email_verified":true}`, "", identity, UpdateUserSetting)
	assert.Contains(t, response.Body.String(), `"success":true`)
	current, err := model.GetUserSetting(user.Id, true)
	require.NoError(t, err)
	assert.Empty(t, current.NotificationEmail)
	assert.False(t, current.NotificationEmailVerified)
}

func TestNotificationEmailFlowBoundaries(t *testing.T) {
	for _, scenario := range []string{"wrong session", "expired", "revoked session", "changed auth version", "attempt limit", "storage rollback", "concurrent confirmation"} {
		t.Run(scenario, func(t *testing.T) {
			user, identity := setupSecurityEnrollmentTest(t)
			hash, err := common.Password2Hash("123456")
			require.NoError(t, err)
			token, flow, err := model.CreateNotificationEmailVerification(identity, "owned@example.com", hash)
			require.NoError(t, err)
			switch scenario {
			case "wrong session":
				bundle, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "other")
				require.NoError(t, err)
				other, err := service.ParseAccessToken(bundle.AccessToken)
				require.NoError(t, err)
				assert.Error(t, model.CompleteNotificationEmailVerification(other, token, "123456"))
			case "expired":
				require.NoError(t, model.DB.Model(flow).Update("expires_at", time.Now().Add(-time.Second)).Error)
				assert.ErrorIs(t, model.CompleteNotificationEmailVerification(identity, token, "123456"), model.ErrAuthFlowExpired)
			case "revoked session":
				require.NoError(t, model.DB.Model(&model.UserSession{}).Where("sid = ?", identity.SessionID).Update("status", model.UserSessionStatusRevoked).Error)
				assert.Error(t, model.CompleteNotificationEmailVerification(identity, token, "123456"))
			case "changed auth version":
				require.NoError(t, model.DB.Model(user).Update("auth_version", identity.UserAuthVersion+1).Error)
				assert.Error(t, model.CompleteNotificationEmailVerification(identity, token, "123456"))
			case "attempt limit":
				for attempt := 1; attempt <= model.EmailBindingMaxAttempts; attempt++ {
					err := model.CompleteNotificationEmailVerification(identity, token, "wrong")
					if attempt == model.EmailBindingMaxAttempts {
						assert.ErrorIs(t, err, model.ErrEmailBindingLocked)
					} else {
						assert.ErrorIs(t, err, model.ErrEmailBindingCodeInvalid)
					}
				}
				assert.ErrorIs(t, model.CompleteNotificationEmailVerification(identity, token, "123456"), model.ErrEmailBindingLocked)
			case "storage rollback":
				failure := errors.New("injected storage failure")
				// Fail the final flow write so the account update must roll back.
				require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register("notification_email_flow_failure", func(tx *gorm.DB) {
					if tx.Statement.Table == "auth_flows" {
						tx.AddError(failure)
					}
				}))
				assert.ErrorIs(t, model.CompleteNotificationEmailVerification(identity, token, "123456"), failure)
				require.NoError(t, model.DB.Callback().Update().Remove("notification_email_flow_failure"))
				pending, err := model.GetAuthFlow(token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeNotificationEmail})
				require.NoError(t, err)
				assert.Nil(t, pending.ConsumedAt)
			case "concurrent confirmation":
				var group sync.WaitGroup
				results := make(chan error, 2)
				for range 2 {
					group.Add(1)
					go func() {
						defer group.Done()
						results <- model.CompleteNotificationEmailVerification(identity, token, "123456")
					}()
				}
				group.Wait()
				close(results)
				successes := 0
				for err := range results {
					if err == nil {
						successes++
					} else {
						assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)
					}
				}
				assert.Equal(t, 1, successes)
			}
			current, err := model.GetUserSetting(user.Id, true)
			require.NoError(t, err)
			assert.Equal(t, scenario == "concurrent confirmation", current.NotificationEmailVerified)
		})
	}
}

func TestNotificationEmailSendingLimitsAndDeliveryFailure(t *testing.T) {
	_, identity := setupSecurityEnrollmentTest(t)
	mailbox := newSecurityMailbox(t)
	first, err := service.StartNotificationEmailVerification(identity, "owned@example.com", "en")
	require.NoError(t, err)
	_, err = service.StartNotificationEmailVerification(identity, "different@example.com", "en")
	assert.ErrorIs(t, err, model.ErrEmailBindingResendWait)
	// Simulate expiry of the account cooldown without weakening destination limits.
	require.NoError(t, model.DB.Model(&model.AuthFlow{}).Where("purpose = ? AND user_id = ?", model.AuthFlowPurposeNotificationEmail, identity.UserID).Update("created_at", time.Now().Add(-2*time.Minute)).Error)
	_, err = service.StartNotificationEmailVerification(identity, "owned@example.com", "en")
	assert.ErrorIs(t, err, model.ErrEmailBindingResendWait)
	second, err := service.StartNotificationEmailVerification(identity, "different@example.com", "en")
	require.NoError(t, err)
	assert.ErrorIs(t, model.CompleteNotificationEmailVerification(identity, first.FlowToken, mailbox.code(t, first.Email)), model.ErrAuthFlowConsumed)
	assert.NotEmpty(t, second.FlowToken)
	require.NoError(t, model.DB.Model(&model.AuthFlow{}).Where("purpose = ? AND user_id = ?", model.AuthFlowPurposeNotificationEmail, identity.UserID).Update("created_at", time.Now().Add(-2*time.Minute)).Error)
	common.SMTPServer = ""
	_, err = service.StartNotificationEmailVerification(identity, "failed@example.com", "en")
	assert.ErrorIs(t, err, service.ErrEmailBindingDelivery)
	var failed model.AuthFlow
	require.NoError(t, model.DB.Where("purpose = ? AND provider = ?", model.AuthFlowPurposeNotificationEmail, "failed@example.com").First(&failed).Error)
	assert.NotNil(t, failed.ConsumedAt)
}
