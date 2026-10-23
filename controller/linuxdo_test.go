package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLinuxDOOAuthBrowserCallbackReturnsToAuthenticatedOpener(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	previousEnabled, previousClient, previousSecret := common.LinuxDOOAuthEnabled, common.LinuxDOClientId, common.LinuxDOClientSecret
	previousAddress, previousTrust := system_setting.ServerAddress, common.LinuxDOMinimumTrustLevel
	previousProvider := oauth.GetProvider("linuxdo")
	common.LinuxDOOAuthEnabled, common.LinuxDOClientId, common.LinuxDOClientSecret = true, "linuxdo-client", "linuxdo-secret"
	system_setting.ServerAddress, common.LinuxDOMinimumTrustLevel = "https://example.com/", 0
	oauth.Register("linuxdo", &oauth.LinuxDOProvider{})
	t.Cleanup(func() {
		common.LinuxDOOAuthEnabled, common.LinuxDOClientId, common.LinuxDOClientSecret = previousEnabled, previousClient, previousSecret
		system_setting.ServerAddress, common.LinuxDOMinimumTrustLevel = previousAddress, previousTrust
		oauth.Register("linuxdo", previousProvider)
	})
	tokenCalls, userCalls := 0, 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/token":
			tokenCalls++
			assert.Equal(t, http.MethodPost, r.Method)
			client, secret, ok := r.BasicAuth()
			assert.True(t, ok)
			assert.Equal(t, "linuxdo-client", client)
			assert.Equal(t, "linuxdo-secret", secret)
			if err := r.ParseForm(); !assert.NoError(t, err) {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			assert.Equal(t, "https://example.com/api/oauth/linuxdo", r.Form.Get("redirect_uri"))
			assert.Equal(t, "one-use-code", r.Form.Get("code"))
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			_, _ = w.Write([]byte(`{"access_token":"provider-token"}`))
		case "/user":
			userCalls++
			assert.Equal(t, "Bearer provider-token", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"id":12345,"username":"linuxdo-user","name":"LinuxDO User","trust_level":2,"active":true}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(provider.Close)
	t.Setenv("LINUX_DO_TOKEN_ENDPOINT", provider.URL+"/token")
	t.Setenv("LINUX_DO_USER_ENDPOINT", provider.URL+"/user")

	proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: []byte(`{"provider":"linuxdo"}`)}, service.VerificationMethodPassword)
	started := securityEnrollmentRequest(http.MethodPost, "/api/oauth/state", `{"provider":"linuxdo","intent":"bind"}`, proof, identity, GenerateOAuthCode)
	var result struct {
		Success bool `json:"success"`
		Data    struct {
			FlowToken        string `json:"flow_token"`
			AuthorizationURL string `json:"authorization_url"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(started.Body.Bytes(), &result))
	require.True(t, result.Success, started.Body.String())
	authorization, err := url.Parse(result.Data.AuthorizationURL)
	require.NoError(t, err)
	assert.Equal(t, "https://connect.linux.do/oauth2/authorize", authorization.Scheme+"://"+authorization.Host+authorization.Path)
	assert.Equal(t, "https://example.com/api/oauth/linuxdo", authorization.Query().Get("redirect_uri"))
	assert.Equal(t, result.Data.FlowToken, authorization.Query().Get("state"))
	assert.Equal(t, "linuxdo-client", authorization.Query().Get("client_id"))
	query := url.Values{"state": {result.Data.FlowToken}, "code": {"one-use-code"}, "next": {"https://foreign.example"}}
	callback := func(query url.Values, current service.AuthIdentity, headers map[string]string) *httptest.ResponseRecorder {
		return securityEnrollmentRequest(http.MethodGet, "/api/oauth/linuxdo?"+query.Encode(), "", "", current, func(c *gin.Context) {
			c.Params = gin.Params{{Key: "provider", Value: "linuxdo"}}
			for key, value := range headers {
				c.Request.Header.Set(key, value)
			}
			HandleOAuth(c)
		})
	}
	for _, headers := range []map[string]string{{"Sec-Fetch-Mode": "navigate"}, {"Accept": "text/html,application/xhtml+xml"}} {
		response := callback(query, service.AuthIdentity{}, headers)
		require.Equal(t, http.StatusSeeOther, response.Code, response.Body.String())
		location, err := url.Parse(response.Header().Get("Location"))
		require.NoError(t, err)
		assert.Empty(t, location.Host)
		assert.Equal(t, "/oauth/linuxdo", location.Path)
		assert.Equal(t, "one-use-code", location.Query().Get("code"))
		assert.Equal(t, result.Data.FlowToken, location.Query().Get("state"))
		assert.Empty(t, location.Query().Get("next"))
		assert.Empty(t, response.Header().Values("Set-Cookie"))
		assert.Equal(t, "no-referrer", response.Header().Get("Referrer-Policy"))
	}
	assert.Zero(t, tokenCalls)
	assert.Zero(t, userCalls)
	flow, err := model.GetAuthFlow(result.Data.FlowToken, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeOAuth, Provider: "linuxdo"})
	require.NoError(t, err)
	assert.Nil(t, flow.ConsumedAt)

	// The redirect does not authorize anonymous requests or another session.
	assert.Equal(t, http.StatusForbidden, callback(query, service.AuthIdentity{}, map[string]string{"Accept": "application/json"}).Code)
	other := identity
	other.SessionID = "other-session"
	assert.Equal(t, http.StatusForbidden, callback(query, other, nil).Code)
	invalid := url.Values{"state": {"invalid-state"}, "code": {"one-use-code"}}
	assert.Equal(t, http.StatusForbidden, callback(invalid, identity, map[string]string{"Accept": "text/html"}).Code)
	assert.Zero(t, tokenCalls)

	response := callback(query, identity, map[string]string{"Accept": "application/json"})
	assert.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var bound securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &bound))
	require.True(t, bound.Success, response.Body.String())
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, "12345", user.LinuxDOId)
	assert.Equal(t, 1, tokenCalls)
	assert.Equal(t, 1, userCalls)
	assert.Equal(t, http.StatusForbidden, callback(query, identity, nil).Code)
	assert.Equal(t, 1, tokenCalls)
}
