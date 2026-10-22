package oauth

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type tokenExchangeTransport func(*http.Request) (*http.Response, error)

func (f tokenExchangeTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestStandardTokenExchangePreservesFieldsAndRejectsUntrustedClientID(t *testing.T) {
	oldTransport := http.DefaultTransport
	oldDiscord := *system_setting.GetDiscordSettings()
	oldOIDC := *system_setting.GetOIDCSettings()
	t.Cleanup(func() {
		http.DefaultTransport = oldTransport
		*system_setting.GetDiscordSettings() = oldDiscord
		*system_setting.GetOIDCSettings() = oldOIDC
	})
	system_setting.GetDiscordSettings().ClientId = "configured-client"
	system_setting.GetOIDCSettings().ClientId = "configured-client"
	system_setting.GetOIDCSettings().TokenEndpoint = "https://issuer.example/token"

	for name, provider := range map[string]interface {
		ExchangeToken(context.Context, string, *gin.Context) (*OAuthToken, error)
	}{
		"discord": &DiscordProvider{},
		"oidc":    &OIDCProvider{},
	} {
		for _, tc := range []struct {
			name, raw string
			wantError bool
		}{
			{"token fields", `{"access_token":"access","id_token":"identity","refresh_token":"refresh","token_type":"Bearer","expires_in":3600,"scope":"openid profile","client_id":"untrusted","ClientID":"untrusted"}`, false},
			{"empty access token", `{"id_token":"identity"}`, true},
			{"malformed response", `{`, true},
		} {
			t.Run(name+"/"+tc.name, func(t *testing.T) {
				http.DefaultTransport = tokenExchangeTransport(func(request *http.Request) (*http.Response, error) {
					require.Equal(t, http.MethodPost, request.Method)
					require.NoError(t, request.ParseForm())
					require.Equal(t, "configured-client", request.Form.Get("client_id"))
					require.Equal(t, "authorization-code", request.Form.Get("code"))
					return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(tc.raw))}, nil
				})
				token, err := provider.ExchangeToken(context.Background(), "authorization-code", nil)
				if tc.wantError {
					require.Error(t, err)
					require.Nil(t, token)
					return
				}
				require.NoError(t, err)
				require.Equal(t, &OAuthToken{
					AccessToken: "access", IDToken: "identity", RefreshToken: "refresh",
					TokenType: "Bearer", ExpiresIn: 3600, Scope: "openid profile",
				}, token)
			})
		}
	}
}
