package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTokenQuotaDefaultAndPartialUpdate(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{"name": "default-quota", "unlimited_quota": true, "expired_time": -1}, 731)
	AddToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)
	var token model.Token
	require.NoError(t, db.Where("user_id = ?", 731).First(&token).Error)
	require.True(t, token.AllowUserQuotaQuery)
	body := map[string]any{"id": token.Id, "name": token.Name, "unlimited_quota": true, "expired_time": -1, "allow_user_quota_query": false}
	ctx, recorder = newAuthenticatedContext(t, http.MethodPut, "/api/token/", body, 731)
	UpdateToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)
	delete(body, "allow_user_quota_query")
	ctx, recorder = newAuthenticatedContext(t, http.MethodPut, "/api/token/", body, 731)
	UpdateToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)
	require.NoError(t, db.First(&token, token.Id).Error)
	require.False(t, token.AllowUserQuotaQuery)
}

func TestTokenQuotaPrivacyAndReadOnlyGuards(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	previousMemory := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemory })
	user := &model.User{Id: 990033, Username: "quota-owner", Quota: 123456, UsedQuota: 456, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	token := seedToken(t, db, user.Id, "quota-guard", "quotaguardtestsecret")
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	engine.GET("/usage", middleware.TokenAuthReadOnly(), GetTokenUsage)
	for _, tc := range []struct {
		name       string
		optIn      bool
		status     int
		allowIP    string
		wantStatus int
		wantOwner  bool
	}{
		{"legacy private", false, common.TokenStatusEnabled, "", 200, false},
		{"opt-in", true, common.TokenStatusEnabled, "", 200, true},
		{"expired", true, common.TokenStatusExpired, "", 200, true},
		{"exhausted", true, common.TokenStatusExhausted, "", 200, true},
		{"disabled", true, 2, "", 403, false},
		{"unknown status", true, 999, "", 403, false},
		{"blocked IP", true, common.TokenStatusEnabled, "192.0.2.0/24", 403, false},
		{"allowed IP", true, common.TokenStatusEnabled, "127.0.0.1", 200, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, db.Model(token).Updates(map[string]any{"allow_user_quota_query": tc.optIn, "status": tc.status, "allow_ips": tc.allowIP}).Error)
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/usage", nil)
			request.RemoteAddr = "127.0.0.1:45678"
			request.Header.Set("Authorization", "Bearer sk-"+token.Key)
			engine.ServeHTTP(recorder, request)
			require.Equal(t, tc.wantStatus, recorder.Code, recorder.Body.String())
			if tc.wantOwner {
				require.Contains(t, recorder.Body.String(), `"user_quota"`)
				require.Contains(t, recorder.Body.String(), `123456`)
			} else {
				require.NotContains(t, recorder.Body.String(), `"user_quota"`)
			}
		})
	}
}
