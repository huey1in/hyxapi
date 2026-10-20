package controller

import (
	"context"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestTokenStatusOnlyPreservesLiveQuotaAndMetadata(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "before", "status-only-owned-key")
	changed := false
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:consume-before-status", func(tx *gorm.DB) {
		if changed || tx.Statement.Table != "tokens" {
			return
		}
		changed = true
		require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).Model(&model.Token{}).Where("id = ?", token.Id).
			Updates(map[string]any{"remain_quota": 73, "used_quota": 27, "name": "concurrent-edit", "model_limits": "new-model"}).Error)
	}))
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=true", map[string]any{
		"id": token.Id, "status": common.TokenStatusDisabled, "remain_quota": 999, "name": "stale-client",
	}, 1)
	UpdateToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)
	var stored model.Token
	require.NoError(t, db.First(&stored, token.Id).Error)
	require.Equal(t, common.TokenStatusDisabled, stored.Status)
	require.Equal(t, 73, stored.RemainQuota)
	require.Equal(t, 27, stored.UsedQuota)
	require.Equal(t, "concurrent-edit", stored.Name)
	require.Equal(t, "new-model", stored.ModelLimits)
	require.NotContains(t, recorder.Body.String(), token.Key)
}

func TestTokenStatusOnlyValidatesOwnershipStatusAndEffectiveLimits(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	token := seedToken(t, db, 1, "owned", "status-owner-key")
	for _, test := range []struct {
		name   string
		owner  int
		status int
	}{
		{"other user", 2, common.TokenStatusDisabled},
		{"zero", 1, 0}, {"unknown", 1, 42}, {"derived expired status", 1, common.TokenStatusExpired},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=true", map[string]int{"id": token.Id, "status": test.status}, test.owner)
			UpdateToken(ctx)
			require.False(t, decodeAPIResponse(t, recorder).Success)
		})
	}
	for _, limits := range []map[string]any{
		{"expired_time": common.GetTimestamp() - 1, "unlimited_quota": true, "remain_quota": 10},
		{"expired_time": -1, "unlimited_quota": false, "remain_quota": 0},
	} {
		limits["status"] = common.TokenStatusDisabled
		require.NoError(t, db.Model(token).Updates(limits).Error)
		ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=true", map[string]int{"id": token.Id, "status": common.TokenStatusEnabled}, 1)
		UpdateToken(ctx)
		require.False(t, decodeAPIResponse(t, recorder).Success)
	}
	require.NoError(t, db.Model(token).Updates(map[string]any{"expired_time": -1, "unlimited_quota": true}).Error)
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=true", map[string]int{"id": token.Id, "status": common.TokenStatusEnabled}, 1)
	UpdateToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)

	ctx, recorder = newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=true", map[string]int{"id": token.Id, "status": common.TokenStatusDisabled}, 1)
	canceled, cancel := context.WithCancel(ctx.Request.Context())
	cancel()
	ctx.Request = ctx.Request.WithContext(canceled)
	UpdateToken(ctx)
	require.False(t, decodeAPIResponse(t, recorder).Success)
	var stored model.Token
	require.NoError(t, db.First(&stored, token.Id).Error)
	require.Equal(t, common.TokenStatusEnabled, stored.Status)
}

func TestTokenBatchDeleteBoundsAndActualOwnedCount(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	owned := seedToken(t, db, 1, "owned", "batch-owned-key")
	other := seedToken(t, db, 2, "other", "batch-other-key")
	for _, ids := range [][]int{make([]int, 1001), {owned.Id, -1}, {0}} {
		ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/batch", map[string]any{"ids": ids}, 1)
		DeleteTokenBatch(ctx)
		require.False(t, decodeAPIResponse(t, recorder).Success)
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/batch", map[string]any{"ids": []int{owned.Id, owned.Id, other.Id, other.Id + 1000}}, 1)
	DeleteTokenBatch(ctx)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)
	require.JSONEq(t, "1", string(response.Data))
	var count int64
	require.NoError(t, db.Model(&model.Token{}).Where("id = ?", other.Id).Count(&count).Error)
	require.EqualValues(t, 1, count)
}
