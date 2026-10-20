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

func TestTokenUsageTimeTracksAuthenticatedCalls(t *testing.T) {
	db := setupRelayIntegrationDB(t)
	user := &model.User{Id: 990072, Username: "token-usage-owner", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, db.Create(user).Error)
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	engine.GET("/usage", middleware.TokenAuthReadOnly(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	engine.POST("/call", middleware.TokenAuth(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
	engine.POST("/failed-call", middleware.TokenAuth(), func(c *gin.Context) { c.Status(http.StatusBadGateway) })

	for _, tc := range []struct {
		name       string
		path       string
		method     string
		status     int
		expired    int64
		allowIP    string
		limited    bool
		wantStatus int
		used       bool
	}{
		{"read-only query", "/usage", http.MethodGet, common.TokenStatusEnabled, -1, "", false, http.StatusNoContent, false},
		{"disabled", "/call", http.MethodPost, common.TokenStatusDisabled, -1, "", false, http.StatusUnauthorized, false},
		{"expired", "/call", http.MethodPost, common.TokenStatusEnabled, 1, "", false, http.StatusUnauthorized, false},
		{"exhausted", "/call", http.MethodPost, common.TokenStatusEnabled, -1, "", true, http.StatusUnauthorized, false},
		{"blocked IP", "/call", http.MethodPost, common.TokenStatusEnabled, -1, "192.0.2.0/24", false, http.StatusForbidden, false},
		{"free call", "/call", http.MethodPost, common.TokenStatusEnabled, -1, "", false, http.StatusNoContent, true},
		{"upstream failure", "/failed-call", http.MethodPost, common.TokenStatusEnabled, -1, "", false, http.StatusBadGateway, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			token := seedToken(t, db, user.Id, tc.name, common.GetRandomString(32))
			require.NoError(t, db.Model(token).Updates(map[string]any{
				"accessed_time": 0, "status": tc.status, "expired_time": tc.expired,
				"allow_ips": tc.allowIP, "unlimited_quota": !tc.limited, "remain_quota": 0,
			}).Error)
			request := httptest.NewRequest(tc.method, tc.path, nil)
			request.RemoteAddr = "127.0.0.1:45678"
			request.Header.Set("Authorization", "Bearer sk-"+token.Key)
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)
			require.Equal(t, tc.wantStatus, recorder.Code, recorder.Body.String())
			var stored model.Token
			require.NoError(t, db.First(&stored, token.Id).Error)
			if tc.used {
				require.Positive(t, stored.AccessedTime)
			} else {
				require.Zero(t, stored.AccessedTime)
			}
			require.Zero(t, stored.UsedQuota, "usage tracking must not depend on consumption")
		})
	}
}
