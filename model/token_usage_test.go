package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestTokenQuotaChangesPreserveUsageTime(t *testing.T) {
	for _, redisEnabled := range []bool{false, true} {
		for _, batchEnabled := range []bool{false, true} {
			for _, accessedTime := range []int64{0, 100} {
				t.Run(fmt.Sprintf("redis=%t/batch=%t/used=%d", redisEnabled, batchEnabled, accessedTime), func(t *testing.T) {
					truncateTables(t)
					resetBatchUpdateTestState(t)
					if redisEnabled {
						useUserCacheMiniRedis(t)
					}
					common.BatchUpdateEnabled = batchEnabled
					token := createReserveTestToken(t, 100)
					require.NoError(t, DB.Model(&token).UpdateColumn("accessed_time", accessedTime).Error)
					token.AccessedTime = accessedTime
					if redisEnabled {
						_, err := cacheInitToken(token)
						require.NoError(t, err)
					}

					reserved, err := TryReserveTokenQuota(token.Id, token.Key, 10, false)
					require.NoError(t, err)
					require.True(t, reserved)
					require.NoError(t, decreaseTokenQuota(token.Id, 5))
					require.NoError(t, increaseTokenQuota(token.Id, 5))
					if redisEnabled {
						// Exercise the cache refund path without background work crossing
						// test database and Redis lifetimes.
						_, err = cacheApplyTokenQuotaDelta(token.Id, token.Key, 10)
						require.NoError(t, err)
					}
					require.NoError(t, persistTokenQuotaDelta(token.Id, 10))
					if batchEnabled {
						batchUpdate()
					}
					reloaded := getTokenFromDB(t, token.Id)
					require.Equal(t, accessedTime, reloaded.AccessedTime, "quota settlement and refunds are not API calls")
					require.Equal(t, 100, reloaded.RemainQuota)
					require.Zero(t, reloaded.UsedQuota)
					if redisEnabled {
						cached, err := cacheGetTokenByKey(token.Key)
						require.NoError(t, err)
						require.Equal(t, accessedTime, cached.AccessedTime)
					}
				})
			}
		}
	}
}

func TestRecordTokenUsagePreservesAccountingAndNewerTimes(t *testing.T) {
	for _, redisEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("redis=%t", redisEnabled), func(t *testing.T) {
			truncateTables(t)
			resetBatchUpdateTestState(t)
			if redisEnabled {
				useUserCacheMiniRedis(t)
			}
			token := createReserveTestToken(t, 100)
			require.NoError(t, RecordTokenUsage(&token))
			reloaded := getTokenFromDB(t, token.Id)
			require.Positive(t, reloaded.AccessedTime, "free calls must also record usage")
			require.Equal(t, 100, reloaded.RemainQuota)
			require.Zero(t, reloaded.UsedQuota)
			if redisEnabled {
				_, err := cacheGetTokenByKey(token.Key)
				require.Error(t, err, "usage must not create an incomplete cache hash")
				_, err = cacheInitToken(reloaded)
				require.NoError(t, err)
			}

			newer := common.GetTimestamp() + 60
			require.NoError(t, DB.Model(&token).UpdateColumn("accessed_time", newer).Error)
			if redisEnabled {
				require.NoError(t, cacheRecordTokenUsage(token.Id, token.Key, newer))
			}
			require.NoError(t, RecordTokenUsage(&token))
			require.Equal(t, newer, getTokenFromDB(t, token.Id).AccessedTime)
			if redisEnabled {
				cached, err := cacheGetTokenByKey(token.Key)
				require.NoError(t, err)
				require.Equal(t, newer, cached.AccessedTime, "older requests must not roll back cached usage")
			}

			// A status change based on an older snapshot must retain live usage.
			token.Status = common.TokenStatusDisabled
			require.NoError(t, token.SelectUpdate())
			require.Equal(t, newer, getTokenFromDB(t, token.Id).AccessedTime)
		})
	}
}
