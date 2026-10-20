package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestCodexRefreshDoesNotOverwriteConcurrentCredentialEdit(t *testing.T) {
	setupAuthSessionTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	initial := `{"access_token":"old","refresh_token":"refresh","account_id":"a"}`
	channel := &model.Channel{Type: constant.ChannelTypeCodex, Key: initial}
	require.NoError(t, model.DB.Create(channel).Error)
	concurrent := `{"access_token":"admin-edit","refresh_token":"new-refresh","account_id":"a"}`
	_, _, err := refreshCodexChannelCredential(context.Background(), channel.Id, CodexCredentialRefreshOptions{}, func(context.Context, string, string) (*CodexOAuthTokenResult, error) {
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("key", concurrent).Error)
		return &CodexOAuthTokenResult{AccessToken: "refreshed", RefreshToken: "rotated", ExpiresAt: time.Now().Add(time.Hour)}, nil
	})
	require.ErrorContains(t, err, "changed during refresh")
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, concurrent, stored.Key)
	key, _, err := refreshCodexChannelCredential(context.Background(), channel.Id, CodexCredentialRefreshOptions{}, func(context.Context, string, string) (*CodexOAuthTokenResult, error) {
		return &CodexOAuthTokenResult{AccessToken: "refreshed", RefreshToken: "rotated", ExpiresAt: time.Now().Add(time.Hour)}, nil
	})
	require.NoError(t, err)
	require.Equal(t, "refreshed", key.AccessToken)
	stored, err = model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Contains(t, stored.Key, `"refresh_token":"rotated"`)
}
