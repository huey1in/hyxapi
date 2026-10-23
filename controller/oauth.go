package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const oauthAuthFlowTTL = 10 * time.Minute

type oauthStateRequest struct {
	Provider string          `json:"provider"`
	Intent   string          `json:"intent"`
	Aff      string          `json:"aff,omitempty"`
	Scope    string          `json:"scope,omitempty"`
	Context  json.RawMessage `json:"context,omitempty"`
}

type oauthFlowPayload struct {
	AffiliateCode   string                         `json:"affiliate_code,omitempty"`
	Verification    *service.OAuthVerificationFlow `json:"verification,omitempty"`
	Telegram        *oauth.TelegramOAuthFlow       `json:"telegram,omitempty"`
	Google          *oauth.GoogleOAuthFlow         `json:"google,omitempty"`
	SessionIdentity *service.AuthIdentity          `json:"session_identity,omitempty"`
	Authorization   *model.AuthFlowAuthorization   `json:"authorization,omitempty"`
}

// providerParams returns the params of messages that name the OAuth provider.
func providerParams(name string) map[string]any {
	return map[string]any{"provider": name}
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	var request oauthStateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	request.Provider = strings.TrimSpace(request.Provider)
	request.Intent = strings.TrimSpace(request.Intent)
	request.Aff = strings.TrimSpace(request.Aff)
	if oauth.GetProvider(request.Provider) == nil ||
		(request.Intent != model.AuthFlowIntentLogin && request.Intent != model.AuthFlowIntentBind && request.Intent != model.AuthFlowIntentVerify) ||
		len(request.Aff) > 32 ||
		(request.Intent != model.AuthFlowIntentLogin && request.Aff != "") ||
		(request.Intent != model.AuthFlowIntentVerify && (request.Scope != "" || len(request.Context) != 0)) {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	userID := 0
	sessionID := ""
	flowPayload := oauthFlowPayload{AffiliateCode: request.Aff}
	bindingStarted := false
	if request.Provider == "telegram" {
		telegramFlow, err := oauth.NewTelegramOAuthFlow()
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		flowPayload.Telegram = telegramFlow
	}
	if request.Provider == "google" {
		googleFlow, err := oauth.NewGoogleOAuthFlow()
		if err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		flowPayload.Google = googleFlow
	}
	if request.Intent == model.AuthFlowIntentBind || request.Intent == model.AuthFlowIntentVerify {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok {
			writeAccountStatusError(c, http.StatusUnauthorized, "Sign in to bind an account")
			return
		}
		userID = identity.UserID
		sessionID = identity.SessionID
		if request.Intent == model.AuthFlowIntentBind {
			defer func() {
				recordUserSecurityAudit(c, userID, "user.binding_start", map[string]any{"provider": request.Provider, "success": bindingStarted})
			}()
			context, err := common.Marshal(service.AccountBindingContext{Provider: request.Provider})
			if err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			flowPayload.Authorization = middleware.RequireSecurityProof(c, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context})
			if flowPayload.Authorization == nil {
				return
			}
			flowPayload.SessionIdentity = &identity
		}
		if flowPayload.Telegram != nil || flowPayload.Google != nil {
			if _, _, err := service.ValidateLoginSession(identity); err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			flowPayload.SessionIdentity = &identity
		}
		if request.Intent == model.AuthFlowIntentVerify {
			verification, err := service.StartOAuthVerification(identity, service.VerificationOperation{Scope: request.Scope, Context: request.Context}, request.Provider)
			if err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			flowPayload.Verification = verification
		}
	}
	payload, err := common.Marshal(flowPayload)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	expiresAt := time.Now().Add(oauthAuthFlowTTL)
	state, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposeOAuth,
		Provider:  request.Provider,
		Intent:    request.Intent,
		UserId:    userID,
		SessionId: sessionID,
		Payload:   string(payload),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	bindingStarted = request.Intent == model.AuthFlowIntentBind
	data := gin.H{"flow_token": state, "expires_at": expiresAt.Unix()}
	if flowPayload.Telegram != nil {
		data["authorization_url"] = flowPayload.Telegram.AuthorizationURL(state)
	}
	if flowPayload.Google != nil {
		data["authorization_url"] = flowPayload.Google.AuthorizationURL(state)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

// HandleOAuth handles OAuth callback for all standard OAuth providers
func HandleOAuth(c *gin.Context) {
	providerName := c.Param("provider")
	provider := oauth.GetProvider(providerName)
	if provider == nil {
		writeAccountStatusError(c, http.StatusBadRequest, "Unknown OAuth provider")
		return
	}
	// 1. Validate state (CSRF protection)
	state := c.Query("state")
	pendingFlow, err := model.GetAuthFlow(state, model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: providerName,
	})
	if err != nil {
		writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
		return
	}

	consumeMatch := model.AuthFlowMatch{
		Purpose:  model.AuthFlowPurposeOAuth,
		Provider: providerName,
		Intent:   pendingFlow.Intent,
	}
	bindSucceeded, notificationFailed := false, false
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		defer func() {
			recordUserSecurityAudit(c, pendingFlow.UserId, "user.binding_bind", map[string]any{"provider": providerName, "success": bindSucceeded, "notification_failed": notificationFailed})
		}()
	}
	// Bind and verification callbacks must use the dashboard session that started them.
	if pendingFlow.Intent == model.AuthFlowIntentBind || pendingFlow.Intent == model.AuthFlowIntentVerify {
		identity, ok := middleware.GetSessionAuthIdentity(c)
		if !ok || identity.UserID != pendingFlow.UserId || identity.SessionID != pendingFlow.SessionId {
			writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
			return
		}
		consumeMatch.UserId = identity.UserID
		consumeMatch.SessionId = identity.SessionID
		if pendingFlow.Intent == model.AuthFlowIntentBind {
			var payload oauthFlowPayload
			if err := common.UnmarshalJsonStr(pendingFlow.Payload, &payload); err != nil {
				writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
				return
			}
			context, err := common.Marshal(service.AccountBindingContext{Provider: providerName})
			if err != nil {
				writeSecurityOperationError(c, err)
				return
			}
			if err := service.ValidateFlowAuthorization(identity, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context}, payload.Authorization); err != nil {
				writeSecurityOperationError(c, err)
				return
			}
		}
	} else if pendingFlow.Intent != model.AuthFlowIntentLogin {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	// 3. Check if provider is enabled
	var pinnedPayload oauthFlowPayload
	if providerName == "telegram" || providerName == "google" {
		configurationError := oauth.TelegramConfigurationError
		if providerName == "google" {
			configurationError = oauth.GoogleConfigurationError
		}
		if err := configurationError(); err != nil {
			writeSecurityOperationError(c, err)
			return
		}
		if err := common.UnmarshalJsonStr(pendingFlow.Payload, &pinnedPayload); err != nil ||
			(providerName == "telegram" && pinnedPayload.Telegram == nil) ||
			(providerName == "google" && pinnedPayload.Google == nil) {
			writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
			return
		}
		if pendingFlow.Intent != model.AuthFlowIntentLogin {
			identity, _ := middleware.GetSessionAuthIdentity(c)
			if pinnedPayload.SessionIdentity == nil || *pinnedPayload.SessionIdentity != identity {
				writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
				return
			}
			if _, _, err := service.ValidateLoginSession(identity); err != nil {
				writeSecurityOperationError(c, err)
				return
			}
		}
		if providerName == "telegram" {
			c.Set(oauth.TelegramOAuthFlowContextKey, pinnedPayload.Telegram)
		} else {
			c.Set(oauth.GoogleOAuthFlowContextKey, pinnedPayload.Google)
		}
	}
	if !provider.IsEnabled() {
		common.ApiErrorT(c, "{{provider}} login and registration has not been enabled by administrator", providerParams(provider.GetName()))
		return
	}

	// 4. Handle error from provider
	errorCode := c.Query("error")
	if errorCode != "" {
		if _, err := model.ConsumeAuthFlow(state, consumeMatch); err != nil {
			writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
			return
		}
		errorDescription := c.Query("error_description")
		if errorDescription == "" {
			errorDescription = errorCode
		}
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
		return
	}
	// 5. Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		if providerName == "telegram" {
			writeSecurityOperationError(c, err)
			return
		}
		handleOAuthError(c, err)
		return
	}

	// 6. Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		if providerName == "telegram" {
			writeSecurityOperationError(c, err)
			return
		}
		handleOAuthError(c, err)
		return
	}
	if pendingFlow.Intent == model.AuthFlowIntentBind {
		bindSucceeded, notificationFailed = handleOAuthBind(c, providerName, provider, oauthUser, pendingFlow, state, consumeMatch)
		return
	}
	flow, err := model.ConsumeAuthFlow(state, consumeMatch)
	if err != nil {
		writeAccountStatusError(c, http.StatusForbidden, "State parameter is empty or mismatched")
		return
	}

	switch flow.Intent {
	case model.AuthFlowIntentLogin:
		handleOAuthLogin(c, provider, oauthUser, token, flow)
	case model.AuthFlowIntentVerify:
		handleOAuthVerification(c, providerName, oauthUser, flow)
	}
}

func handleOAuthVerification(c *gin.Context, provider string, oauthUser *oauth.OAuthUser, flow *model.AuthFlow) {
	var payload oauthFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	identity, _ := middleware.GetSessionAuthIdentity(c)
	proof, err := service.FinishOAuthVerification(identity, provider, oauthUser.ProviderUserID, payload.Verification)
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	recordUserSecurityAudit(c, identity.UserID, "user.security_verify", map[string]any{"method": proof.Method, "scope": proof.Scope, "provider": provider})
	common.ApiSuccess(c, proof)
}

func handleOAuthLogin(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, token *oauth.OAuthToken, flow *model.AuthFlow) {
	// 7. Find or create user
	var payload oauthFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		writeSecurityOperationError(c, err)
		return
	}
	user, err := findOrCreateOAuthUser(provider, oauthUser, payload.AffiliateCode)
	if err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			common.ApiErrorT(c, "Email address is already in use")
			return
		}
		switch err.(type) {
		case *OAuthUserDeletedError:
			common.ApiErrorT(c, "User has been deleted")
		case *OAuthRegistrationDisabledError:
			common.ApiErrorT(c, "New user registration has been disabled by administrator")
		case *OAuthEmailAlreadyTakenError:
			common.ApiErrorT(c, "Email address is already in use")
		default:
			writeSecurityOperationError(c, err)
		}
		return
	}

	// 8. Check user status
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorT(c, "User has been banned")
		return
	}

	// 9. Setup login
	setupLogin(user, c)
}

// handleOAuthBind handles binding OAuth account to existing user
func handleOAuthBind(c *gin.Context, providerName string, provider oauth.Provider, oauthUser *oauth.OAuthUser, flow *model.AuthFlow, state string, match model.AuthFlowMatch) (bool, bool) {
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		writeSecurityOperationError(c, service.ErrAuthTokenInvalid)
		return false, false
	}
	var payload oauthFlowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		writeSecurityOperationError(c, model.ErrAuthFlowInvalid)
		return false, false
	}
	context, err := common.Marshal(service.AccountBindingContext{Provider: providerName})
	if err != nil {
		writeSecurityOperationError(c, err)
		return false, false
	}
	// Recheck after the external provider round trip, then validate the session
	// under the transaction's locks before consuming the flow and writing.
	if err := service.ValidateFlowAuthorization(identity, service.VerificationOperation{Scope: service.VerificationScopeAccountBind, Context: context}, payload.Authorization); err != nil {
		writeSecurityOperationError(c, err)
		return false, false
	}
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		common.ApiErrorT(c, "This {{provider}} account has already been bound", providerParams(provider.GetName()))
		return false, false
	}
	_, err = model.ConsumeAuthFlowWithAction(state, match, func(tx *gorm.DB, _ *model.AuthFlow) error {
		if providerName == "telegram" {
			return model.BindTelegramForSessionWithTx(tx, identity, oauthUser.ProviderUserID)
		}
		if providerName == "google" {
			return model.BindGoogleForSessionWithTx(tx, identity, oauthUser.ProviderUserID)
		}
		if custom, ok := provider.(*oauth.GenericOAuthProvider); ok {
			return model.UpdateUserOAuthBindingForSessionWithTx(tx, identity, custom.GetProviderId(), oauthUser.ProviderUserID)
		}
		return model.UpdateUserBindColumnForSessionWithTx(tx, identity, provider.ProviderUserIDColumn(), oauthUser.ProviderUserID)
	})
	if err != nil {
		writeSecurityOperationError(c, err)
		return false, false
	}
	user, err := model.GetUserById(identity.UserID, false)
	if err != nil {
		writeSecurityOperationError(c, err)
		return true, true
	}
	notificationFailed := service.NotifyAccountSecurityChange(service.AccountMailLanguage(c, user.Id), user.Email, i18n.MsgSecurityEventLoginLinked, map[string]any{"Provider": provider.GetName()}) != nil
	common.ApiSuccessT(c, "Binding successful", gin.H{"action": "bind", "notification_warning": notificationFailed})
	return true, notificationFailed
}

// findOrCreateOAuthUser resolves the provider account ID or creates a new account.
func findOrCreateOAuthUser(provider oauth.Provider, oauthUser *oauth.OAuthUser, affiliateCode string) (*model.User, error) {
	user := &model.User{}
	if provider.ProviderUserIDColumn() == "telegram_id" {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, oauth.ErrTelegramAccountNotBound
		}
		return user, err
	}

	// Check if user already exists with new ID
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if err != nil {
			return nil, err
		}
		// Check if user has been deleted
		if user.Id == 0 {
			return nil, &OAuthUserDeletedError{}
		}
		return user, nil
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled {
		return nil, &OAuthRegistrationDisabledError{}
	}

	// Set up new user
	user.Username = provider.GetProviderPrefix() + strconv.Itoa(model.GetMaxUserId()+1)

	if oauthUser.Username != "" {
		if exists, err := model.CheckUserExistOrDeleted(oauthUser.Username, ""); err == nil && !exists {
			// 防止索引退化
			if len(oauthUser.Username) <= model.UserNameMaxLength {
				user.Username = oauthUser.Username
			}
		}
	}

	if oauthUser.DisplayName != "" {
		user.DisplayName = oauthUser.DisplayName
	} else if oauthUser.Username != "" {
		user.DisplayName = oauthUser.Username
	} else {
		user.DisplayName = provider.GetName() + " User"
	}
	if oauthUser.Email != "" {
		user.Email = model.NormalizeEmail(oauthUser.Email)
		if err := model.EnsureEmailAvailable(user.Email, 0); err != nil {
			if errors.Is(err, model.ErrEmailAlreadyTaken) {
				return nil, &OAuthEmailAlreadyTakenError{}
			}
			return nil, err
		}
	}
	user.Role = common.RoleCommonUser
	user.Status = common.UserStatusEnabled

	// Handle affiliate code
	inviterId := 0
	if affiliateCode != "" {
		inviterId, _ = model.GetUserIdByAffCode(affiliateCode)
	}

	// Use transaction to ensure user creation and OAuth binding are atomic
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: create user and binding in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx); err != nil {
				return err
			}

			// Create OAuth binding
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: oauthUser.ProviderUserID,
			}
			if err := model.CreateUserOAuthBindingWithTx(tx, binding); err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, err
		}
	} else {
		// Built-in provider: create user and update provider ID in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx); err != nil {
				return err
			}

			// Set the provider user ID on the user model and update
			provider.SetProviderUserID(user, oauthUser.ProviderUserID)
			if provider.ProviderUserIDColumn() == "google_id" {
				if err := model.ClaimExternalIdentityWithTx(tx, model.ExternalIdentityProviderGoogle, oauthUser.ProviderUserID, user.Id); err != nil {
					return err
				}
			}
			if err := tx.Model(user).Updates(map[string]any{
				"github_id":   user.GitHubId,
				"google_id":   user.GoogleId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
			}).Error; err != nil {
				return err
			}

			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	user.FinishInsert(inviterId)
	return user, nil
}

// Error types for OAuth
type OAuthUserDeletedError struct{}

func (e *OAuthUserDeletedError) Error() string {
	return "user has been deleted"
}

type OAuthRegistrationDisabledError struct{}

func (e *OAuthRegistrationDisabledError) Error() string {
	return "registration is disabled"
}

type OAuthEmailAlreadyTakenError struct{}

func (e *OAuthEmailAlreadyTakenError) Error() string {
	return "email is already in use"
}

// handleOAuthError handles OAuth errors and returns a web console message
func handleOAuthError(c *gin.Context, err error) {
	switch e := err.(type) {
	case *oauth.OAuthError:
		common.ApiError(c, e.Message)
	case *oauth.AccessDeniedError:
		common.ApiErrorMsg(c, e.Message)
	case *oauth.TrustLevelError:
		common.ApiErrorT(c, "Linux DO trust level does not meet the minimum required by administrator")
	default:
		writeSecurityOperationError(c, err)
	}
}
