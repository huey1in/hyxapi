package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestInvitationRewardEndpointsRejectDisabledFeatures(t *testing.T) {
	gin.SetMode(gin.TestMode)
	payment := operation_setting.GetPaymentSetting()
	previous := *payment
	t.Cleanup(func() { *payment = previous })
	for _, fixture := range []struct {
		name      string
		enabled   bool
		confirmed bool
		version   string
	}{
		{"default disabled", false, true, operation_setting.CurrentComplianceTermsVersion},
		{"unconfirmed", true, false, operation_setting.CurrentComplianceTermsVersion},
		{"outdated terms", true, true, "outdated"},
	} {
		*payment = operation_setting.PaymentSetting{InvitationRewardsEnabled: fixture.enabled, ComplianceConfirmed: fixture.confirmed, ComplianceTermsVersion: fixture.version}
		for _, endpoint := range []struct {
			method  string
			path    string
			handler gin.HandlerFunc
		}{
			{http.MethodGet, "/api/user/aff", GetAffCode},
			{http.MethodPost, "/api/user/aff_transfer", TransferAffQuota},
		} {
			t.Run(fixture.name+endpoint.path, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(endpoint.method, endpoint.path, strings.NewReader(`{"quota":500000}`))
				ctx.Request.Header.Set("Content-Type", "application/json")
				endpoint.handler(ctx)
				var reply struct {
					Success bool   `json:"success"`
					Message string `json:"message"`
				}
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &reply))
				require.False(t, reply.Success)
				require.NotEmpty(t, reply.Message)
			})
		}
	}
}

func TestTopUpInfoReportsEffectiveInvitationRewardsState(t *testing.T) {
	payment := operation_setting.GetPaymentSetting()
	previous := *payment
	t.Cleanup(func() { *payment = previous })
	for _, enabled := range []bool{false, true} {
		for _, confirmed := range []bool{false, true} {
			*payment = operation_setting.PaymentSetting{InvitationRewardsEnabled: enabled, ComplianceConfirmed: confirmed, ComplianceTermsVersion: operation_setting.CurrentComplianceTermsVersion}
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)
			GetTopUpInfo(ctx)
			var reply struct {
				Success bool `json:"success"`
				Data    struct {
					Enabled *bool `json:"enable_invitation_rewards"`
				} `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &reply))
			require.True(t, reply.Success)
			require.NotNil(t, reply.Data.Enabled)
			require.Equal(t, enabled && confirmed, *reply.Data.Enabled)
		}
	}
}
