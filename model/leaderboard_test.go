package model

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestLeaderboardUsesSeparateDatabasesAndOnlyActiveMembersConsumption(t *testing.T) {
	previousDB, previousLogDB := DB, LOG_DB
	t.Cleanup(func() { DB, LOG_DB = previousDB, previousLogDB })
	var err error
	DB, err = gorm.Open(sqlite.Open(t.TempDir()+"/users.db"), &gorm.Config{})
	require.NoError(t, err)
	LOG_DB, err = gorm.Open(sqlite.Open(t.TempDir()+"/logs.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, DB.AutoMigrate(&User{}))
	require.NoError(t, LOG_DB.AutoMigrate(&Log{}))
	for index, user := range []User{
		{Id: 1, Username: "current-name", Email: "private@example.com", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 2, Username: "admin", Role: common.RoleAdminUser, Status: common.UserStatusEnabled},
		{Id: 3, Username: "disabled", Role: common.RoleCommonUser, Status: common.UserStatusDisabled},
		{Id: 4, Username: "deleted", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 5, Username: "support", Role: common.RoleSupportUser, Status: common.UserStatusEnabled},
	} {
		user.AffCode = string(rune('a' + index))
		require.NoError(t, DB.Create(&user).Error)
	}
	require.NoError(t, DB.Delete(&User{}, 4).Error)
	logs := []Log{
		{UserId: 1, Username: "old-name", CreatedAt: 100, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 4, CompletionTokens: 6, Other: "private-content"},
		{UserId: 1, CreatedAt: 200, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 8, CompletionTokens: 2},
		{UserId: 1, CreatedAt: 150, Type: LogTypeConsume, ModelName: "model-b"},
		{UserId: 1, CreatedAt: 99, Type: LogTypeConsume, PromptTokens: 999},
		{UserId: 1, CreatedAt: 201, Type: LogTypeConsume, PromptTokens: 999},
		{UserId: 1, CreatedAt: 150, Type: LogTypeError, PromptTokens: 999},
		{UserId: 1, CreatedAt: 150, Type: LogTypeRefund, PromptTokens: 999},
	}
	for _, id := range []int{2, 3, 4, 5, 999} {
		logs = append(logs, Log{UserId: id, CreatedAt: 150, Type: LogTypeConsume, PromptTokens: 999})
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)
	rows, err := GetLeaderboardUsage(context.Background(), 100, 200)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	var requests, tokens int64
	for _, row := range rows {
		require.Equal(t, 1, row.UserID)
		require.Equal(t, "current-name", row.Username)
		requests += row.Requests
		tokens += row.Tokens
	}
	require.EqualValues(t, 3, requests)
	require.EqualValues(t, 20, tokens)
	encoded, err := json.Marshal(rows)
	require.NoError(t, err)
	require.JSONEq(t, `[{},{}]`, string(encoded))
	_, err = GetLeaderboardUsage(context.Background(), 0, 32*86400)
	require.Error(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = GetLeaderboardUsage(ctx, 100, 200)
	require.ErrorIs(t, err, context.Canceled)
}
