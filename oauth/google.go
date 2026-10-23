package oauth

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

const (
	GoogleIssuer              = "https://accounts.google.com"
	GoogleOAuthFlowContextKey = "google_oauth_flow"
)

var (
	ErrGoogleOAuthNotConfigured = errors.New("Google OAuth is not configured or enabled. Please contact your administrator.")
	ErrGoogleOAuthConflict      = errors.New("The google OAuth provider name is reserved. Ask your administrator to rename the conflicting custom provider.")
	ErrGoogleOAuthFailed        = errors.New("Google authorization failed. Please try again.")
)

// GoogleOAuthFlow pins the callback, audience, nonce and PKCE verifier on the
// server for the entire round trip. Only AuthorizationURL goes to the browser.
type GoogleOAuthFlow struct {
	CodeVerifier string `json:"code_verifier"`
	Nonce        string `json:"nonce"`
	ClientID     string `json:"client_id"`
	RedirectURI  string `json:"redirect_uri"`
}

func GoogleConfigurationError() error {
	if HasCustomProviderConflict("google") {
		return ErrGoogleOAuthConflict
	}
	settings := system_setting.GetGoogleSettings()
	if !settings.Enabled || !settings.IsConfigured() {
		return ErrGoogleOAuthNotConfigured
	}
	return nil
}

func GoogleRedirectURI() string {
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/oauth/google"
}

func NewGoogleOAuthFlow() (*GoogleOAuthFlow, error) {
	if err := GoogleConfigurationError(); err != nil {
		return nil, err
	}
	redirect := GoogleRedirectURI()
	parsed, err := url.Parse(redirect)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" ||
		(parsed.Scheme != "https" && parsed.Scheme != "http") {
		return nil, ErrGoogleOAuthNotConfigured
	}
	return &GoogleOAuthFlow{
		CodeVerifier: oauth2.GenerateVerifier(), Nonce: oauth2.GenerateVerifier(),
		ClientID: strings.TrimSpace(system_setting.GetGoogleSettings().ClientID), RedirectURI: redirect,
	}, nil
}

func (flow *GoogleOAuthFlow) AuthorizationURL(state string) string {
	values := url.Values{
		"client_id": {flow.ClientID}, "redirect_uri": {flow.RedirectURI},
		"response_type": {"code"}, "scope": {"openid email profile"},
		"state": {state}, "nonce": {flow.Nonce},
		"code_challenge": {oauth2.S256ChallengeFromVerifier(flow.CodeVerifier)}, "code_challenge_method": {"S256"},
	}
	return GoogleIssuer + "/o/oauth2/v2/auth?" + values.Encode()
}

type GoogleProvider struct {
	client *http.Client
	keys   oidc.KeySet
}

func init() {
	Register("google", NewGoogleProvider(&http.Client{Timeout: 20 * time.Second}))
}

func NewGoogleProvider(client *http.Client) *GoogleProvider {
	return &GoogleProvider{client: client, keys: oidc.NewRemoteKeySet(
		oidc.ClientContext(context.Background(), client), "https://www.googleapis.com/oauth2/v3/certs",
	)}
}

func (p *GoogleProvider) GetName() string { return "Google" }

func (p *GoogleProvider) IsEnabled() bool { return GoogleConfigurationError() == nil }

func (p *GoogleProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if err := GoogleConfigurationError(); err != nil {
		return nil, err
	}
	if c == nil {
		return nil, ErrGoogleOAuthFailed
	}
	value, _ := c.Get(GoogleOAuthFlowContextKey)
	flow, ok := value.(*GoogleOAuthFlow)
	settings := system_setting.GetGoogleSettings()
	if !ok || flow == nil || code == "" || flow.CodeVerifier == "" || flow.Nonce == "" ||
		flow.ClientID != strings.TrimSpace(settings.ClientID) || flow.RedirectURI != GoogleRedirectURI() {
		return nil, ErrGoogleOAuthFailed
	}
	values := url.Values{
		"grant_type": {"authorization_code"}, "code": {code},
		"client_id": {flow.ClientID}, "client_secret": {strings.TrimSpace(settings.ClientSecret)},
		"redirect_uri": {flow.RedirectURI}, "code_verifier": {flow.CodeVerifier},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleOAuthFailed, err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")
	response, err := p.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleOAuthFailed, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: token endpoint status %d", ErrGoogleOAuthFailed, response.StatusCode)
	}
	var token OAuthToken
	if err := common.DecodeJson(io.LimitReader(response.Body, 1<<20), &token); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleOAuthFailed, err)
	}
	if token.IDToken == "" {
		return nil, ErrGoogleOAuthFailed
	}
	// Neither field can be supplied by the provider's token JSON.
	token.ClientID, token.Nonce = flow.ClientID, flow.Nonce
	return &token, nil
}

func (p *GoogleProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	if err := GoogleConfigurationError(); err != nil {
		return nil, err
	}
	if token == nil || token.Nonce == "" || token.ClientID != strings.TrimSpace(system_setting.GetGoogleSettings().ClientID) {
		return nil, ErrGoogleOAuthFailed
	}
	verifier := oidc.NewVerifier(GoogleIssuer, p.keys, &oidc.Config{ClientID: token.ClientID, SupportedSigningAlgs: []string{oidc.RS256}})
	verified, err := verifier.Verify(ctx, token.IDToken)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleOAuthFailed, err)
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Authorized    string `json:"azp"`
	}
	if err := verified.Claims(&claims); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleOAuthFailed, err)
	}
	if verified.Subject == "" || len(verified.Subject) > 255 || verified.Nonce != token.Nonce ||
		!claims.EmailVerified || strings.TrimSpace(claims.Email) == "" ||
		(claims.Authorized != "" && claims.Authorized != token.ClientID) ||
		(len(verified.Audience) > 1 && claims.Authorized == "") {
		return nil, ErrGoogleOAuthFailed
	}
	// The stable Google subject is the identity. Matching email addresses never
	// silently links an existing local or OIDC account.
	return &OAuthUser{ProviderUserID: verified.Subject, DisplayName: claims.Name, Email: model.NormalizeEmail(claims.Email)}, nil
}

func (p *GoogleProvider) IsUserIDTaken(id string) bool {
	var count int64
	return model.DB.Unscoped().Model(&model.User{}).Where("google_id = ?", id).Count(&count).Error == nil && count > 0
}

func (p *GoogleProvider) FillUserByProviderID(user *model.User, id string) error {
	// Keep deleted identities reserved, as with the other built-in providers.
	err := model.DB.Where("google_id = ?", id).First(user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	return err
}

func (p *GoogleProvider) SetProviderUserID(user *model.User, id string) { user.GoogleId = id }

func (p *GoogleProvider) GetProviderPrefix() string { return "google_" }

func (p *GoogleProvider) ProviderUserIDColumn() string { return "google_id" }
