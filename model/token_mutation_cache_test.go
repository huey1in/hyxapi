package model

import (
	"context"
	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestTokenMetadataMutationsInvalidateLiveCache(t *testing.T) {
	for _, operation := range []string{"update", "status", "status-only", "delete", "batch"} {
		t.Run(operation, func(t *testing.T) {
			truncateTables(t)
			resetBatchUpdateTestState(t)
			useUserCacheMiniRedis(t)
			token := createReserveTestToken(t, 100)
			_, err := cacheInitToken(token)
			require.NoError(t, err)
			stale := token
			// These entry points also support callers that only know the row ID.
			token.Key = ""
			token.Status = common.TokenStatusDisabled
			token.ModelLimitsEnabled = true
			token.ModelLimits = "allowed-model"
			token.AutoGroups = `["vip","default"]`
			switch operation {
			case "update":
				err = token.Update()
			case "status":
				err = token.SelectUpdate()
			case "status-only":
				_, err = SetUserTokenStatus(context.Background(), token.UserId, token.Id, common.TokenStatusDisabled)
			case "delete":
				err = token.Delete()
			case "batch":
				_, err = BatchDeleteTokens([]int{token.Id}, token.UserId)
			}
			require.NoError(t, err)
			_, err = cacheGetTokenByKey(stale.Key)
			require.Error(t, err)
			result, err := cacheInitToken(stale)
			require.NoError(t, err)
			require.Zero(t, result, "an in-flight stale reader must not republish old permissions")
			if operation == "update" || operation == "status" || operation == "status-only" {
				fresh, err := GetTokenByKey(stale.Key, false)
				require.NoError(t, err)
				require.Equal(t, common.TokenStatusDisabled, fresh.Status)
				if operation == "update" {
					require.Equal(t, "allowed-model", fresh.ModelLimits)
					require.Equal(t, token.AutoGroups, fresh.AutoGroups)
				}
			} else {
				_, err := GetTokenByKey(stale.Key, false)
				require.Error(t, err)
			}
		})
	}
}

func TestTokenAutoGroupsRedisHashRoundTrip(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	useUserCacheMiniRedis(t)
	token := createReserveTestToken(t, 100)
	require.NoError(t, token.SetAutoGroups([]string{"vip", "default"}))
	_, err := cacheInitToken(token)
	require.NoError(t, err)
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	groups, err := cached.GetAutoGroups()
	require.NoError(t, err)
	require.Equal(t, []string{"vip", "default"}, groups)
}

func TestTokenMetadataMutationStopsWhenInvalidationFails(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	server := useUserCacheMiniRedis(t)
	token := createReserveTestToken(t, 100)
	_, err := cacheInitToken(token)
	require.NoError(t, err)
	server.Close()
	token.Status = common.TokenStatusDisabled
	require.Error(t, token.Update())
	require.Equal(t, common.TokenStatusEnabled, getTokenFromDB(t, token.Id).Status)
}
