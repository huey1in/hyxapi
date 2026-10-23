package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSupportRoleHasTicketAccessWithoutAdministratorPrivileges(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)
	gin.SetMode(gin.TestMode)
	user := createMiddlewarePATUser(t, "support-agent", "support-legacy-token")
	require.NoError(t, model.DB.Model(user).Update("role", common.RoleSupportUser).Error)
	now := time.Now().Unix()
	session := &model.UserSession{SID: "support-session", UserID: user.Id, Version: 1, UserAuthVersion: user.AuthVersion, Status: model.UserSessionStatusActive, RefreshHash: "refresh-hash", LoginMethod: "password", LastActiveAt: now, ExpiresAt: now + 3600}
	require.NoError(t, model.CreateUserSession(session))
	token, _, err := service.IssueAccessToken(service.AuthIdentity{UserID: user.Id, SessionID: session.SID, UserAuthVersion: user.AuthVersion, SessionVersion: 1})
	require.NoError(t, err)
	router := gin.New()
	allowed := func(c *gin.Context) { c.Status(http.StatusOK) }
	router.GET("/api/tickets", UserAuth(), allowed)
	router.GET("/api/tickets/manage", UserAuth(), SupportAuth(), allowed)
	router.GET("/api/user/", AdminAuth(), allowed)
	router.GET("/api/option/", RootAuth(), allowed)
	for _, test := range []struct {
		path, token string
		status      int
	}{
		{"/api/tickets", token, http.StatusOK},
		{"/api/tickets/manage", token, http.StatusOK},
		{"/api/user/", token, http.StatusForbidden},
		{"/api/option/", token, http.StatusForbidden},
		{"/api/tickets", "support-legacy-token", http.StatusForbidden},
		{"/api/tickets/manage", "support-legacy-token", http.StatusForbidden},
	} {
		request := httptest.NewRequest(http.MethodGet, test.path, nil)
		request.Header.Set("Authorization", "Bearer "+test.token)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		require.Equal(t, test.status, response.Code, response.Body.String())
	}
	for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleRootUser} {
		require.NoError(t, model.DB.Model(user).Update("role", role).Error)
		require.NoError(t, model.PublishUserAuthCache(user.Id))
		request := httptest.NewRequest(http.MethodGet, "/api/tickets/manage", nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		want := http.StatusOK
		if role == common.RoleCommonUser {
			want = http.StatusForbidden
		}
		require.Equal(t, want, response.Code, response.Body.String())
	}
}
