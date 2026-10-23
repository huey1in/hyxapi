package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUserRoleEditorRequiresProofAndRevokesPreviousSessions(t *testing.T) {
	actor, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.Model(actor).Update("role", common.RoleRootUser).Error)
	require.NoError(t, model.PublishUserAuthCache(actor.Id))
	identity, _ := createAccessTokenTestSession(t, actor.Id, "role-editor-root")
	target := &model.User{Username: "role-target", DisplayName: "Target", Password: "placeholder", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", Quota: 123, UsedQuota: 45, AuthVersion: 1, AffCode: "role-target"}
	require.NoError(t, model.DB.Create(target).Error)
	operation := service.VerificationOperation{Scope: service.VerificationScopeAdminUserUpdate, Context: []byte(fmt.Sprintf(`{"user_id":%d}`, target.Id))}
	for _, role := range []int{common.RoleSupportUser, common.RoleAdminUser, common.RoleSupportUser, common.RoleCommonUser} {
		previous, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		bundle, err := service.CreateLoginSession(target.Id, "password", "127.0.0.1", "old-role-session")
		require.NoError(t, err)
		oldIdentity, err := service.ParseAccessToken(bundle.AccessToken)
		require.NoError(t, err)
		body := fmt.Sprintf(`{"id":%d,"username":"role-target","display_name":"Updated","group":"default","role":%d}`, target.Id, role)
		request := func(proof string) *httptest.ResponseRecorder {
			return securityEnrollmentRequest("PUT", "/api/user/", body, proof, identity, func(c *gin.Context) {
				c.Set("role", common.RoleRootUser)
				UpdateUser(c)
			})
		}
		missing := request("")
		require.Equal(t, http.StatusForbidden, missing.Code, missing.Body.String())
		require.Contains(t, missing.Body.String(), "SECURITY_PROOF_REQUIRED")
		proof := issueSecurityEnrollmentProof(t, identity, operation, service.VerificationMethodPassword)
		response := request(proof)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		require.Contains(t, response.Body.String(), `"success":true`)
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		require.Equal(t, role, stored.Role)
		require.Greater(t, stored.AuthVersion, previous.AuthVersion)
		require.Equal(t, 123, stored.Quota)
		require.Equal(t, 45, stored.UsedQuota)
		var active int64
		require.NoError(t, model.DB.Model(&model.UserSession{}).Where("sid = ? AND status = ?", oldIdentity.SessionID, model.UserSessionStatusActive).Count(&active).Error)
		require.Zero(t, active, "the previous role must not survive in browser sessions")
		if role < common.RoleAdminUser {
			require.Empty(t, authz.ExplicitUserOverrides(target.Id))
		} else {
			require.NoError(t, authz.SetUserPermissions(target.Id, authz.PermissionsMap{"channel": {"read": false}}))
			require.NotEmpty(t, authz.ExplicitUserOverrides(target.Id))
		}
	}
}

func TestUserRoleEditorEnforcesHierarchyAndProtectsRoot(t *testing.T) {
	actor, _ := setupAccessTokenAudit(t)
	identity, _ := createAccessTokenTestSession(t, actor.Id, "role-editor-admin")
	for i, test := range []struct{ actor, current, next int }{
		{10, 1, 10}, {10, 1, 100}, {10, 5, 10}, {10, 10, 5},
		{100, 1, 100}, {100, 100, 1}, {100, 100, 10}, {100, 1, 2},
	} {
		target := &model.User{Username: fmt.Sprintf("role-deny-%d", i), Role: test.current, Status: common.UserStatusEnabled, Group: "default", AffCode: fmt.Sprintf("role-deny-%d", i)}
		require.NoError(t, model.DB.Create(target).Error)
		body := fmt.Sprintf(`{"id":%d,"username":%q,"group":"default","role":%d}`, target.Id, target.Username, test.next)
		response := securityEnrollmentRequest("PUT", "/api/user/", body, "", identity, func(c *gin.Context) {
			c.Set("role", test.actor)
			UpdateUser(c)
		})
		require.Contains(t, response.Body.String(), `"success":false`)
		require.NotContains(t, response.Body.String(), "SECURITY_PROOF_REQUIRED", "hierarchy must be checked before requesting proof")
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		require.Equal(t, test.current, stored.Role)
	}
}

func TestUserRoleEditorLetsAdministratorsChangeLowerRoles(t *testing.T) {
	actor, _ := setupAccessTokenAudit(t)
	identity, _ := createAccessTokenTestSession(t, actor.Id, "role-editor-lower")
	target := &model.User{Username: "lower-role", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AffCode: "lower-role"}
	require.NoError(t, model.DB.Create(target).Error)
	for _, role := range []int{common.RoleSupportUser, common.RoleCommonUser} {
		proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
			Scope: service.VerificationScopeAdminUserUpdate, Context: []byte(fmt.Sprintf(`{"user_id":%d}`, target.Id)),
		}, service.VerificationMethodPassword)
		body := fmt.Sprintf(`{"id":%d,"username":%q,"group":"default","role":%d}`, target.Id, target.Username, role)
		response := securityEnrollmentRequest("PUT", "/api/user/", body, proof, identity, func(c *gin.Context) {
			c.Set("role", common.RoleAdminUser)
			UpdateUser(c)
		})
		require.Contains(t, response.Body.String(), `"success":true`)
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		require.Equal(t, role, stored.Role)
	}
}
