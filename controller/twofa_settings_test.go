package controller

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTwoFAFeatureSwitchPersistsAndAppearsInSiteStatus(t *testing.T) {
	_, identity := setupSecurityEnrollmentTest(t)
	common.OptionMapRWMutex.Lock()
	previousMap := common.OptionMap
	previousValue, existed := common.OptionMap["twofa.enabled"]
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if previousMap == nil {
			common.OptionMap = nil
		} else if existed {
			common.OptionMap["twofa.enabled"] = previousValue
		} else {
			delete(common.OptionMap, "twofa.enabled")
		}
	})
	for _, enabled := range []bool{false, true, false} {
		value := "false"
		if enabled {
			value = "true"
		}
		require.NoError(t, model.UpdateOption("twofa.enabled", value))
		assert.Equal(t, enabled, system_setting.IsTwoFAEnabled())
		var stored model.Option
		require.NoError(t, model.DB.First(&stored, "key = ?", "twofa.enabled").Error)
		assert.Equal(t, value, stored.Value)
		response := securityEnrollmentRequest("GET", "/api/status", "", "", identity, GetStatus)
		var body struct {
			Success bool `json:"success"`
			Data    struct {
				TwoFactorEnabled bool `json:"two_factor_enabled"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
		require.True(t, body.Success)
		assert.Equal(t, enabled, body.Data.TwoFactorEnabled)
	}
}

func TestSecurityEnrollmentTwoFAFeatureSwitchBlocksNewAndPendingSetup(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	authorization := authorizeSecurityEnrollment(t, identity)
	system_setting.GetTwoFASettings().Enabled = false
	_, err := service.GetVerificationRequirements(identity, service.VerificationScopeTwoFASetup)
	assert.ErrorIs(t, err, service.ErrTwoFAEnrollmentDisabled)
	_, err = service.StartTwoFASetup(identity, authorization)
	assert.ErrorIs(t, err, service.ErrTwoFAEnrollmentDisabled)
	response := securityEnrollmentRequest("POST", "/api/user/2fa/setup", `{}`, "", identity, Setup2FA)
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Contains(t, response.Body.String(), "TWOFA_ENROLLMENT_DISABLED")
	factor, err := model.GetTwoFAByUserId(user.Id)
	require.NoError(t, err)
	assert.Nil(t, factor)

	system_setting.GetTwoFASettings().Enabled = true
	setup, err := service.StartTwoFASetup(identity, authorization)
	require.NoError(t, err)
	code, err := totp.GenerateCode(setup.Secret, time.Now())
	require.NoError(t, err)
	system_setting.GetTwoFASettings().Enabled = false
	assert.ErrorIs(t, service.FinishTwoFASetup(identity, setup.FlowToken, code), service.ErrTwoFAEnrollmentDisabled)
	response = securityEnrollmentRequest("POST", "/api/user/2fa/enable", `{"flow_token":"`+setup.FlowToken+`","code":"`+code+`"}`, "", identity, Enable2FA)
	assert.Equal(t, http.StatusForbidden, response.Code)
	factor, err = model.GetTwoFAByUserId(user.Id)
	require.NoError(t, err)
	require.NotNil(t, factor)
	assert.False(t, factor.IsEnabled)
	storedUser, err := model.GetUserById(user.Id, false)
	require.NoError(t, err)
	assert.Equal(t, identity.UserAuthVersion, storedUser.AuthVersion)
}

func TestSecurityLoginTwoFAFeatureSwitchPreservesEnrolledFactors(t *testing.T) {
	for _, backup := range []bool{false, true} {
		name := "TOTP"
		if backup {
			name = "backup code"
		}
		t.Run(name, func(t *testing.T) {
			user, identity := setupSecurityEnrollmentTest(t)
			system_setting.GetTwoFASettings().Enabled = false
			factor := &model.TwoFA{UserId: user.Id, Secret: "JBSWY3DPEHPK3PXP", IsEnabled: true}
			require.NoError(t, model.DB.Create(factor).Error)
			requirements, err := service.GetVerificationRequirements(identity, service.VerificationScopePasswordChange)
			require.NoError(t, err)
			require.Len(t, requirements.Methods, 1)
			assert.Equal(t, service.VerificationMethodTwoFA, requirements.Methods[0].Method)
			assert.True(t, requirements.Methods[0].Available)
			challenge, err := service.StartLoginVerification(user, "password", nil)
			require.NoError(t, err)
			require.NotNil(t, challenge, "disabling enrollment must not bypass existing MFA")
			code, err := totp.GenerateCode(factor.Secret, time.Now())
			require.NoError(t, err)
			if backup {
				code = "ABCD-1234"
				hash, err := common.HashBackupCode(code)
				require.NoError(t, err)
				require.NoError(t, model.DB.Create(&model.TwoFABackupCode{UserId: user.Id, CodeHash: hash}).Error)
			}
			response := securityEnrollmentRequest("POST", "/api/user/login/verify", `{"flow_token":"`+challenge.FlowToken+`","code":"`+code+`"}`, "", service.AuthIdentity{}, VerifyLogin)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			require.True(t, result.Success, response.Body.String())
			var bundle service.AuthBundle
			require.NoError(t, common.Unmarshal(result.Data, &bundle))
			assert.NotEmpty(t, bundle.AccessToken)
		})
	}
}
