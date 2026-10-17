package controller

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// Only the existing-account login methods are needed for this provider.
type sessionOAuthProvider struct {
	oauth.Provider
	user          model.User
	exchangeCalls int
}

func (p *sessionOAuthProvider) IsEnabled() bool { return true }

func (p *sessionOAuthProvider) ExchangeToken(context.Context, string, *gin.Context) (*oauth.OAuthToken, error) {
	p.exchangeCalls++
	return &oauth.OAuthToken{AccessToken: "test-token"}, nil
}

func (p *sessionOAuthProvider) GetUserInfo(context.Context, *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return &oauth.OAuthUser{ProviderUserID: "existing-account"}, nil
}

func (p *sessionOAuthProvider) IsUserIDTaken(string) bool { return true }

func (p *sessionOAuthProvider) FillUserByProviderID(user *model.User, _ string) error {
	*user = p.user
	return nil
}

func TestHandleOAuthBrowserCallbackUsesCurrentSite(t *testing.T) {
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	engine := gin.New()
	engine.GET("/api/oauth/:provider", HandleOAuth)
	req := httptest.NewRequest(http.MethodGet, "/api/oauth/github?code=provider-code&state=valid-state", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusFound, recorder.Code)
	require.Equal(t, "/oauth/github?code=provider-code&state=valid-state", recorder.Header().Get("Location"))
	require.Empty(t, recorder.Result().Cookies())
}

func TestHandleOAuthUsesSameOriginSession(t *testing.T) {
	require.NoError(t, i18n.Init())
	previousMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(previousMode) })
	originalProvider := oauth.GetProvider("github")
	t.Cleanup(func() { oauth.Register("github", originalProvider) })

	for _, tc := range []struct {
		name          string
		state         string
		userStatus    int
		responseCode  int
		wantLogin     bool
		exchangeCalls int
	}{
		{"login", "valid-state", common.UserStatusEnabled, http.StatusOK, true, 1},
		{"invalid state", "wrong-state", common.UserStatusEnabled, http.StatusForbidden, false, 0},
		{"disabled user", "valid-state", common.UserStatusDisabled, http.StatusOK, false, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			provider := &sessionOAuthProvider{user: model.User{
				Id: 42, Username: "oauth-user", DisplayName: "OAuth User",
				Role: common.RoleCommonUser, Status: tc.userStatus,
			}}
			oauth.Register("github", provider)
			engine := gin.New()
			engine.Use(sessions.Sessions("session", cookie.NewStore([]byte("same-origin-session-test-key"))))
			engine.GET("/prepare", func(c *gin.Context) {
				session := sessions.Default(c)
				session.Set("oauth_state", "valid-state")
				require.NoError(t, session.Save())
				c.Status(http.StatusNoContent)
			})
			engine.GET("/api/oauth/:provider", HandleOAuth)
			engine.GET("/session", func(c *gin.Context) {
				session := sessions.Default(c)
				c.JSON(http.StatusOK, gin.H{
					"id": session.Get("id"), "username": session.Get("username"),
					"role": session.Get("role"), "status": session.Get("status"),
				})
			})

			prepare := httptest.NewRecorder()
			engine.ServeHTTP(prepare, httptest.NewRequest(http.MethodGet, "/prepare", nil))
			req := httptest.NewRequest(http.MethodGet, "/api/oauth/github?code=provider-code&state="+tc.state, nil)
			for _, value := range prepare.Result().Cookies() {
				req.AddCookie(value)
			}
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, req)
			require.Equal(t, tc.responseCode, recorder.Code)
			require.Empty(t, recorder.Header().Get("Location"))
			require.Equal(t, tc.exchangeCalls, provider.exchangeCalls)
			var response struct {
				Success bool           `json:"success"`
				Data    map[string]any `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			require.Equal(t, tc.wantLogin, response.Success)
			if !tc.wantLogin {
				require.Empty(t, recorder.Result().Cookies())
				return
			}
			require.Equal(t, map[string]any{
				"id": float64(42), "username": "oauth-user", "display_name": "OAuth User",
				"role": float64(common.RoleCommonUser), "status": float64(common.UserStatusEnabled),
			}, response.Data)

			sessionRequest := httptest.NewRequest(http.MethodGet, "/session", nil)
			values := recorder.Result().Cookies()
			require.NotEmpty(t, values)
			for _, value := range values {
				require.Empty(t, value.Domain)
				sessionRequest.AddCookie(value)
			}
			sessionRecorder := httptest.NewRecorder()
			engine.ServeHTTP(sessionRecorder, sessionRequest)
			require.JSONEq(t, `{"id":42,"username":"oauth-user","role":1,"status":1}`, sessionRecorder.Body.String())
		})
	}
}
