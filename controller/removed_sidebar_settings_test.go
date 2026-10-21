package controller

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRemovedPersonalSidebarSettingsCannotBeRestored(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.UpdateUserSetting(user.Id, dto.UserSetting{Language: "en", BillingPreference: "wallet_only"}))
	response := securityEnrollmentRequest("PUT", "/api/user/self", `{"sidebar_modules":"{\"console\":{\"enabled\":false}}"}`, "", identity, UpdateSelf)
	require.Contains(t, response.Body.String(), `"success":false`)
	for _, item := range []struct {
		handler gin.HandlerFunc
		body    string
	}{
		{UpdateSelf, `{"language":"ja","sidebar_modules":"legacy"}`},
		{UpdateSelf, `{"display_name":"Updated","setting":"{\"sidebar_modules\":\"legacy\"}"}`},
		{UpdateUserSetting, `{"record_ip_log":true,"sidebar_modules":"legacy"}`},
	} {
		response = securityEnrollmentRequest("PUT", "/settings", item.body, "", identity, item.handler)
		require.Contains(t, response.Body.String(), `"success":true`)
	}
	stored, err := model.GetUserById(user.Id, false)
	require.NoError(t, err)
	require.NotContains(t, stored.Setting, "sidebar_modules")
	require.Equal(t, "Updated", stored.DisplayName)
	current := stored.GetSetting()
	require.Equal(t, "ja", current.Language)
	require.Equal(t, "wallet_only", current.BillingPreference)
	require.True(t, current.RecordIpLog)
	for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleRootUser} {
		stored.Role = role
		profile := buildSelfUserData(stored)
		require.NotContains(t, profile, "sidebar_modules")
		permissions := profile["permissions"].(map[string]any)
		require.Len(t, permissions, 1)
		require.Contains(t, permissions, "admin_permissions")
	}
	response = securityEnrollmentRequest("GET", "/api/user/self", "", "", identity, GetSelf)
	var result struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success)
	require.NotContains(t, response.Body.String(), "sidebar_modules")
	require.NotContains(t, response.Body.String(), "sidebar_settings")
}
