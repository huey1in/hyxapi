package controller

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPermissionEditorRequiresTargetBoundProofAndPreservesProfile(t *testing.T) {
	root, _ := setupAccessTokenAudit(t)
	require.NoError(t, model.DB.Model(root).Update("role", common.RoleRootUser).Error)
	require.NoError(t, model.PublishUserAuthCache(root.Id))
	bundle, err := service.CreateLoginSession(root.Id, "password", "127.0.0.1", "permission-test")
	require.NoError(t, err)
	identity, err := service.ParseAccessToken(bundle.AccessToken)
	require.NoError(t, err)
	admin := &model.User{Username: "managed-admin", Password: "placeholder", Role: common.RoleAdminUser,
		Status: common.UserStatusEnabled, Group: "custom", DisplayName: "Admin", Remark: "preserve me", AffCode: "managed-admin"}
	require.NoError(t, model.DB.Create(admin).Error)
	router := gin.New()
	router.PUT("/api/authz/user/:id/permissions", func(c *gin.Context) {
		c.Set("id", root.Id)
		c.Set("role", common.RoleRootUser)
		c.Set("session_id", identity.SessionID)
		c.Set("auth_version", identity.UserAuthVersion)
		c.Set("session_version", identity.SessionVersion)
		UpdateUserPermissions(c)
	})
	path := fmt.Sprintf("/api/authz/user/%d/permissions", admin.Id)
	body := `{"permissions":{"channel":{"read":false}}}`
	missing := accessTokenRequest(router, "PUT", path, bundle.AccessToken, "", body)
	assert.Equal(t, http.StatusForbidden, missing.Code)
	assert.Contains(t, missing.Body.String(), "SECURITY_PROOF_REQUIRED")
	proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
		Scope: service.VerificationScopeAdminUserUpdate, Context: []byte(fmt.Sprintf(`{"user_id":%d}`, admin.Id)),
	}, service.VerificationMethodPassword)
	response := accessTokenRequest(router, "PUT", path, bundle.AccessToken, proof, body)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"success":true`)
	stored, err := model.GetUserById(admin.Id, false)
	require.NoError(t, err)
	assert.Equal(t, admin.Group, stored.Group)
	assert.Equal(t, admin.DisplayName, stored.DisplayName)
	assert.Equal(t, admin.Remark, stored.Remark)
	assert.False(t, authz.Can(admin.Id, admin.Role, authz.ChannelRead))
	replayed := accessTokenRequest(router, "PUT", path, bundle.AccessToken, proof, body)
	assert.Equal(t, http.StatusForbidden, replayed.Code)
	assert.Contains(t, replayed.Body.String(), "SECURITY_PROOF_CONSUMED")
}
