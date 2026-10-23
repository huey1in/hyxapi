package controller

import (
	"context"
	"encoding/json"
	"github.com/QuantumNous/new-api/service"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// Only the existing-account login methods are needed for this provider.
type sessionOAuthProvider struct {
	oauth.Provider
	user          model.User
	exchangeCalls int
}

func (p *sessionOAuthProvider) IsEnabled() bool              { return true }
func (p *sessionOAuthProvider) GetName() string              { return "GitHub" }
func (p *sessionOAuthProvider) ProviderUserIDColumn() string { return "github_id" }

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

func TestHandleOAuthUsesSameOriginSession(t *testing.T) {
	require.NoError(t, i18n.Init())
	originalProvider := oauth.GetProvider("github")
	t.Cleanup(func() { oauth.Register("github", originalProvider) })
	for _, tc := range []struct {
		name      string
		invalid   bool
		status    int
		success   bool
		exchanges int
	}{
		{"login", false, common.UserStatusEnabled, true, 1},
		{"invalid state", true, common.UserStatusEnabled, false, 0},
		{"disabled user", false, common.UserStatusDisabled, false, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			user, _ := setupSecurityEnrollmentTest(t)
			require.NoError(t, model.DB.Model(user).Updates(map[string]any{"status": tc.status, "github_id": "existing-account"}).Error)
			user.Status = tc.status
			user.GitHubId = "existing-account"
			provider := &sessionOAuthProvider{user: *user}
			oauth.Register("github", provider)
			state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{Purpose: model.AuthFlowPurposeOAuth, Provider: "github", Intent: model.AuthFlowIntentLogin, Payload: "{}", ExpiresAt: time.Now().Add(time.Minute)})
			require.NoError(t, err)
			if tc.invalid {
				state = "wrong-state"
			}
			engine := gin.New()
			engine.GET("/api/oauth/:provider", HandleOAuth)
			req := httptest.NewRequest(http.MethodGet, "/api/oauth/github?code=provider-code&state="+state, nil)
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, req)
			require.Empty(t, recorder.Header().Get("Location"))
			require.Equal(t, tc.exchanges, provider.exchangeCalls)
			var response struct {
				Success bool `json:"success"`
				Data    struct {
					AccessToken string `json:"access_token"`
					User        struct {
						ID int `json:"id"`
					} `json:"user"`
				} `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			require.Equal(t, tc.success, response.Success, recorder.Body.String())
			if !tc.success {
				return
			}
			require.Equal(t, user.Id, response.Data.User.ID)
			identity, err := service.ParseAccessToken(response.Data.AccessToken)
			require.NoError(t, err)
			require.Equal(t, user.Id, identity.UserID)
			cookies := recorder.Result().Cookies()
			require.NotEmpty(t, cookies)
			hasRefresh := false
			for _, cookie := range cookies {
				require.Empty(t, cookie.Domain)
				if cookie.Name == service.RefreshCookieName {
					hasRefresh = true
					require.True(t, cookie.HttpOnly)
					require.Equal(t, "/api/user/auth", cookie.Path)
				}
			}
			require.True(t, hasRefresh)
			// OAuth state is one-use even when the browser repeats the callback.
			retry := httptest.NewRecorder()
			engine.ServeHTTP(retry, httptest.NewRequest(http.MethodGet, req.URL.String(), nil))
			require.Equal(t, http.StatusForbidden, retry.Code)
			require.Equal(t, 1, provider.exchangeCalls)
		})
	}
}
