package controller

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

type googleTestTransport func(*http.Request) (*http.Response, error)

func (transport googleTestTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

type googleTestGrant struct {
	challenge string
	claims    jwt.MapClaims
}

type googleOAuthFixture struct {
	user        *model.User
	identity    service.AuthIdentity
	key         *rsa.PrivateKey
	signingKey  *rsa.PrivateKey
	grants      map[string]googleTestGrant
	tokenStatus int
}

func setupGoogleOAuthTest(t *testing.T) *googleOAuthFixture {
	t.Helper()
	user, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ExternalIdentityClaim{}))
	previousSettings, previousAddress := *system_setting.GetGoogleSettings(), system_setting.ServerAddress
	previousProvider, previousRegistration := oauth.GetProvider("google"), common.RegisterEnabled
	*system_setting.GetGoogleSettings() = system_setting.GoogleSettings{Enabled: true, ClientID: "google-client", ClientSecret: "google-secret"}
	system_setting.ServerAddress, common.RegisterEnabled = "https://example.com/", true
	t.Cleanup(func() {
		*system_setting.GetGoogleSettings(), system_setting.ServerAddress = previousSettings, previousAddress
		common.RegisterEnabled = previousRegistration
		oauth.Register("google", previousProvider)
		oauth.UnregisterCustomProvider("google")
	})
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	fixture := &googleOAuthFixture{user: user, identity: identity, key: key, signingKey: key, grants: map[string]googleTestGrant{}}
	client := &http.Client{Transport: googleTestTransport(func(request *http.Request) (*http.Response, error) {
		payload, status := []byte(`{}`), http.StatusOK
		switch request.URL.String() {
		case "https://www.googleapis.com/oauth2/v3/certs":
			payload, err = common.Marshal(map[string]any{"keys": []any{map[string]any{
				"kty": "RSA", "kid": "google-test", "alg": "RS256", "use": "sig",
				"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
				"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
			}}})
			require.NoError(t, err)
		case "https://oauth2.googleapis.com/token":
			require.Equal(t, http.MethodPost, request.Method)
			require.NoError(t, request.ParseForm())
			assert.Equal(t, "google-client", request.Form.Get("client_id"))
			assert.Equal(t, "google-secret", request.Form.Get("client_secret"))
			assert.Equal(t, "https://example.com/oauth/google", request.Form.Get("redirect_uri"))
			assert.Equal(t, "authorization_code", request.Form.Get("grant_type"))
			grant, exists := fixture.grants[request.Form.Get("code")]
			if !exists || grant.challenge != oauth2.S256ChallengeFromVerifier(request.Form.Get("code_verifier")) {
				status = http.StatusBadRequest
				break
			}
			delete(fixture.grants, request.Form.Get("code"))
			if fixture.tokenStatus != 0 {
				status = fixture.tokenStatus
				break
			}
			token := jwt.NewWithClaims(jwt.SigningMethodRS256, grant.claims)
			token.Header["kid"] = "google-test"
			signed, signErr := token.SignedString(fixture.signingKey)
			require.NoError(t, signErr)
			payload, err = common.Marshal(map[string]any{
				"access_token": "google-access-token", "id_token": signed,
				"client_id": "untrusted-client", "ClientID": "untrusted-client", "Nonce": "untrusted-nonce",
			})
			require.NoError(t, err)
		default:
			return nil, fmt.Errorf("unexpected Google request: %s", request.URL.String())
		}
		return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(string(payload)))}, nil
	}), Timeout: 5 * time.Second}
	oauth.Register("google", oauth.NewGoogleProvider(client))
	return fixture
}

func googleIdentityClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss": oauth.GoogleIssuer, "aud": "google-client", "sub": "100001234567890123456",
		"iat": time.Now().Unix(), "exp": time.Now().Add(time.Minute).Unix(),
		"email": "google-user@example.com", "email_verified": true, "name": "Google User",
	}
}

func (fixture *googleOAuthFixture) authorization(t *testing.T, intent string, identity service.AuthIdentity, claims jwt.MapClaims) (string, string) {
	t.Helper()
	stateRequest := oauthStateRequest{Provider: "google", Intent: intent}
	if intent == "verify" {
		stateRequest.Scope = service.VerificationScopeAccountDelete
	}
	request, err := common.Marshal(stateRequest)
	require.NoError(t, err)
	proof := ""
	if intent == "bind" {
		proof = issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: []byte(`{"provider":"google"}`)}, service.VerificationMethodPassword)
	}
	response := securityEnrollmentRequest("POST", "/api/oauth/state", string(request), proof, identity, GenerateOAuthCode)
	var body securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	require.True(t, body.Success, response.Body.String())
	var data struct {
		State string `json:"flow_token"`
		URL   string `json:"authorization_url"`
	}
	require.NoError(t, common.Unmarshal(body.Data, &data))
	authorizationURL, err := url.Parse(data.URL)
	require.NoError(t, err)
	assert.Equal(t, "https://accounts.google.com/o/oauth2/v2/auth", authorizationURL.Scheme+"://"+authorizationURL.Host+authorizationURL.Path)
	assert.Equal(t, "openid email profile", authorizationURL.Query().Get("scope"))
	assert.Equal(t, "S256", authorizationURL.Query().Get("code_challenge_method"))
	assert.Equal(t, "https://example.com/oauth/google", authorizationURL.Query().Get("redirect_uri"))
	assert.Equal(t, data.State, authorizationURL.Query().Get("state"))
	assert.NotEmpty(t, authorizationURL.Query().Get("nonce"))
	assert.Empty(t, authorizationURL.Query().Get("code_verifier"))
	assert.NotContains(t, response.Body.String(), "google-secret")
	if _, present := claims["nonce"]; !present {
		claims["nonce"] = authorizationURL.Query().Get("nonce")
	}
	code := "code-" + data.State
	fixture.grants[code] = googleTestGrant{challenge: authorizationURL.Query().Get("code_challenge"), claims: claims}
	return data.State, code
}

func googleOAuthCallback(state, code string, identity service.AuthIdentity) *httptest.ResponseRecorder {
	path := "/api/oauth/google?" + url.Values{"state": {state}, "code": {code}}.Encode()
	return securityEnrollmentRequest("GET", path, "", "", identity, func(c *gin.Context) {
		c.Params = gin.Params{{Key: "provider", Value: "google"}}
		HandleOAuth(c)
	})
}

func TestGoogleOAuthRegistersAndReusesStableIdentity(t *testing.T) {
	fixture := setupGoogleOAuthTest(t)
	state, code := fixture.authorization(t, "login", service.AuthIdentity{}, googleIdentityClaims())
	response := googleOAuthCallback(state, code, service.AuthIdentity{})
	require.Contains(t, response.Body.String(), `"success":true`, response.Body.String())
	var registered model.User
	require.NoError(t, model.DB.Where("google_id = ?", "100001234567890123456").First(&registered).Error)
	assert.Equal(t, "google-user@example.com", registered.Email)
	assert.Empty(t, registered.OidcId)
	var claim model.ExternalIdentityClaim
	require.NoError(t, model.DB.Where("provider = ? AND subject = ?", "google", registered.GoogleId).First(&claim).Error)
	assert.Equal(t, registered.Id, claim.UserId)
	assert.Equal(t, http.StatusForbidden, googleOAuthCallback(state, code, service.AuthIdentity{}).Code)

	claims := googleIdentityClaims()
	claims["email"] = "changed@example.com"
	state, code = fixture.authorization(t, "login", service.AuthIdentity{}, claims)
	response = googleOAuthCallback(state, code, service.AuthIdentity{})
	require.Contains(t, response.Body.String(), `"success":true`)
	var login struct {
		Data struct {
			User struct {
				ID int `json:"id"`
			} `json:"user"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &login))
	assert.Equal(t, registered.Id, login.Data.User.ID)
	profile, err := model.GetSelfUserById(registered.Id)
	require.NoError(t, err)
	assert.Equal(t, registered.GoogleId, profile.GoogleId)
	assert.Equal(t, registered.GoogleId, buildSelfUserData(profile)["google_id"])
}

func TestGoogleOAuthDoesNotMergeMatchingEmailOrRegisterWhenDisabled(t *testing.T) {
	for _, scenario := range []string{"matching email", "registration disabled", "deleted account"} {
		t.Run(scenario, func(t *testing.T) {
			fixture := setupGoogleOAuthTest(t)
			claims := googleIdentityClaims()
			switch scenario {
			case "matching email":
				require.NoError(t, model.DB.Model(fixture.user).Update("email", claims["email"]).Error)
			case "registration disabled":
				common.RegisterEnabled = false
			case "deleted account":
				require.NoError(t, model.DB.Model(fixture.user).Update("google_id", claims["sub"]).Error)
				require.NoError(t, model.DB.Delete(fixture.user).Error)
			}
			state, code := fixture.authorization(t, "login", service.AuthIdentity{}, claims)
			response := googleOAuthCallback(state, code, service.AuthIdentity{})
			assert.Contains(t, response.Body.String(), `"success":false`)
			var users int64
			require.NoError(t, model.DB.Unscoped().Model(&model.User{}).Count(&users).Error)
			assert.EqualValues(t, 1, users)
		})
	}
}

func TestGoogleOAuthRejectsInvalidIdentityTokens(t *testing.T) {
	fixture := setupGoogleOAuthTest(t)
	for _, scenario := range []string{"issuer", "audience", "expiry", "nonce", "unverified email", "missing email", "missing subject", "authorized party", "multiple audiences", "signature", "PKCE", "provider failure"} {
		t.Run(scenario, func(t *testing.T) {
			claims := googleIdentityClaims()
			switch scenario {
			case "issuer":
				claims["iss"] = "https://other.example"
			case "audience":
				claims["aud"] = "other-client"
			case "expiry":
				claims["exp"] = time.Now().Add(-time.Minute).Unix()
			case "nonce":
				claims["nonce"] = "other-flow"
			case "unverified email":
				claims["email_verified"] = false
			case "missing email":
				delete(claims, "email")
			case "missing subject":
				delete(claims, "sub")
			case "authorized party":
				claims["azp"] = "other-client"
			case "multiple audiences":
				claims["aud"] = []string{"google-client", "other-client"}
			case "signature":
				key, err := rsa.GenerateKey(rand.Reader, 2048)
				require.NoError(t, err)
				fixture.signingKey = key
			case "provider failure":
				fixture.tokenStatus = http.StatusServiceUnavailable
			}
			state, code := fixture.authorization(t, "login", service.AuthIdentity{}, claims)
			if scenario == "PKCE" {
				grant := fixture.grants[code]
				grant.challenge = "other-challenge"
				fixture.grants[code] = grant
			}
			response := googleOAuthCallback(state, code, service.AuthIdentity{})
			assert.Contains(t, response.Body.String(), "GOOGLE_OAUTH_FAILED")
			assert.NotContains(t, response.Body.String(), "google-secret")
			fixture.signingKey, fixture.tokenStatus = fixture.key, 0
		})
	}
}

func TestGoogleOAuthBindingIsAtomicAndSessionBound(t *testing.T) {
	fixture := setupGoogleOAuthTest(t)
	state, code := fixture.authorization(t, "bind", fixture.identity, googleIdentityClaims())
	bundle, err := service.CreateLoginSession(fixture.user.Id, "password", "127.0.0.1", "other")
	require.NoError(t, err)
	other, err := service.ParseAccessToken(bundle.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, http.StatusForbidden, googleOAuthCallback(state, code, other).Code)
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register("google_bind_failure", func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			tx.AddError(fmt.Errorf("private Google bind failure"))
		}
	}))
	response := googleOAuthCallback(state, code, fixture.identity)
	assert.Equal(t, http.StatusInternalServerError, response.Code)
	assert.NotContains(t, response.Body.String(), "private Google")
	require.NoError(t, model.DB.Callback().Update().Remove("google_bind_failure"))
	var count int64
	require.NoError(t, model.DB.Model(&model.ExternalIdentityClaim{}).Count(&count).Error)
	assert.Zero(t, count)

	state, code = fixture.authorization(t, "bind", fixture.identity, googleIdentityClaims())
	response = googleOAuthCallback(state, code, fixture.identity)
	require.Contains(t, response.Body.String(), `"success":true`)
	stored, err := model.GetUserById(fixture.user.Id, false)
	require.NoError(t, err)
	assert.Equal(t, "100001234567890123456", stored.GoogleId)
	assert.Equal(t, fixture.user.Role, stored.Role)
	assert.Equal(t, fixture.user.AuthVersion, stored.AuthVersion)
	assert.Equal(t, http.StatusForbidden, googleOAuthCallback(state, code, fixture.identity).Code)
	// The existing policy uses a password when one is present. OAuth-only users
	// must be able to verify sensitive operations with their bound Google account.
	require.NoError(t, model.DB.Model(stored).Update("password", "").Error)
	methods, err := service.GetVerificationRequirements(fixture.identity, service.VerificationScopeAccountDelete)
	require.NoError(t, err)
	found := false
	for _, provider := range methods.OAuthProviders {
		found = found || provider.Slug == "google"
	}
	assert.True(t, found, "bound Google account must be available for security verification")
	state, code = fixture.authorization(t, "verify", fixture.identity, googleIdentityClaims())
	response = googleOAuthCallback(state, code, fixture.identity)
	require.Contains(t, response.Body.String(), `"success":true`, response.Body.String())
	assert.Contains(t, response.Body.String(), `"proof_token"`)
	require.NoError(t, stored.ClearBinding("google"))
	require.NoError(t, model.DB.Model(&model.ExternalIdentityClaim{}).Where("provider = ?", "google").Count(&count).Error)
	assert.Zero(t, count)
}

func TestGoogleOAuthConfigurationGatesTheEntryAndProtectsSecrets(t *testing.T) {
	fixture := setupGoogleOAuthTest(t)
	response := securityEnrollmentRequest("GET", "/api/status", "", "", service.AuthIdentity{}, GetStatus)
	assert.Contains(t, response.Body.String(), `"google_oauth":true`)
	assert.Contains(t, response.Body.String(), `"google_redirect_uri":"https://example.com/oauth/google"`)
	assert.NotContains(t, response.Body.String(), "google-secret")
	settings := system_setting.GetGoogleSettings()
	settings.Enabled = false
	response = securityEnrollmentRequest("POST", "/api/oauth/state", `{"provider":"google","intent":"login"}`, "", fixture.identity, GenerateOAuthCode)
	assert.Contains(t, response.Body.String(), "GOOGLE_OAUTH_NOT_CONFIGURED")
	settings.Enabled, settings.ClientSecret = true, ""
	assert.ErrorIs(t, oauth.GoogleConfigurationError(), oauth.ErrGoogleOAuthNotConfigured)
	response = securityEnrollmentRequest("PUT", "/api/option/", `{"key":"google.enabled","value":true}`, "", fixture.identity, UpdateOption)
	assert.Contains(t, response.Body.String(), `"success":false`)
}
