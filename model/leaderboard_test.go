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

func TestLeaderboardUsesSeparateDatabasesAndIncludesActiveMembersAndAdministrators(t *testing.T) {
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
		{Id: 2, Username: "admin", Email: "admin-private@example.com", Role: common.RoleAdminUser, Status: common.UserStatusEnabled},
		{Id: 3, Username: "disabled", Role: common.RoleCommonUser, Status: common.UserStatusDisabled},
		{Id: 4, Username: "deleted", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
		{Id: 5, Username: "support", Role: common.RoleSupportUser, Status: common.UserStatusEnabled},
		{Id: 6, Username: "root", Email: "root-private@example.com", Role: common.RoleRootUser, Status: common.UserStatusEnabled},
		{Id: 7, Username: "disabled-admin", Role: common.RoleAdminUser, Status: common.UserStatusDisabled},
		{Id: 8, Username: "deleted-root", Role: common.RoleRootUser, Status: common.UserStatusEnabled},
	} {
		user.AffCode = string(rune('a' + index))
		require.NoError(t, DB.Create(&user).Error)
	}
	require.NoError(t, DB.Delete(&User{}, 4).Error)
	require.NoError(t, DB.Delete(&User{}, 8).Error)
	logs := []Log{
		{UserId: 1, Username: "old-name", CreatedAt: 100, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 4, CompletionTokens: 6, Other: "private-content"},
		{UserId: 1, CreatedAt: 200, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 8, CompletionTokens: 2},
		{UserId: 1, CreatedAt: 150, Type: LogTypeConsume, ModelName: "model-b"},
		{UserId: 1, CreatedAt: 99, Type: LogTypeConsume, PromptTokens: 999},
		{UserId: 1, CreatedAt: 201, Type: LogTypeConsume, PromptTokens: 999},
		{UserId: 1, CreatedAt: 150, Type: LogTypeError, PromptTokens: 999},
		{UserId: 1, CreatedAt: 150, Type: LogTypeRefund, PromptTokens: 999},
		{UserId: 2, CreatedAt: 150, Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 30, CompletionTokens: 10},
		{UserId: 6, CreatedAt: 150, Type: LogTypeConsume, ModelName: "model-b", PromptTokens: 5, CompletionTokens: 55},
	}
	for _, id := range []int{3, 4, 5, 7, 8, 999} {
		logs = append(logs, Log{UserId: id, CreatedAt: 150, Type: LogTypeConsume, PromptTokens: 999})
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)
	rows, err := GetLeaderboardUsage(context.Background(), 100, 200)
	require.NoError(t, err)
	require.Len(t, rows, 4)
	byUser := make(map[int][]LeaderboardUsage)
	var requests, tokens int64
	for _, row := range rows {
		byUser[row.UserID] = append(byUser[row.UserID], row)
		requests += row.Requests
		tokens += row.Tokens
	}
	require.Len(t, byUser, 3)
	require.Len(t, byUser[1], 2)
	for _, row := range byUser[1] {
		require.Equal(t, "current-name", row.Username)
	}
	require.Len(t, byUser[2], 1)
	require.Equal(t, "admin", byUser[2][0].Username)
	require.EqualValues(t, 1, byUser[2][0].Requests)
	require.EqualValues(t, 40, byUser[2][0].Tokens)
	require.Len(t, byUser[6], 1)
	require.Equal(t, "root", byUser[6][0].Username)
	require.EqualValues(t, 1, byUser[6][0].Requests)
	require.EqualValues(t, 60, byUser[6][0].Tokens)
	require.EqualValues(t, 5, requests)
	require.EqualValues(t, 120, tokens)
	encoded, err := json.Marshal(rows)
	require.NoError(t, err)
	require.JSONEq(t, `[{},{},{},{}]`, string(encoded))
	_, err = GetLeaderboardUsage(context.Background(), 0, 32*86400)
	require.Error(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = GetLeaderboardUsage(ctx, 100, 200)
	require.ErrorIs(t, err, context.Canceled)
}
