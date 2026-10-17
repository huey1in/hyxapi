package service

import (
	"context"
	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

func TestLogExportRedisOwnershipAndRenewal(t *testing.T) {
	address := os.Getenv("REDIS_TEST_ADDR")
	if address == "" {
		t.Skip("set REDIS_TEST_ADDR to a dedicated test Redis instance")
	}
	ctx := context.Background()
	client := redis.NewClient(&redis.Options{Addr: address, DB: 14})
	require.NoError(t, client.Ping(ctx).Err())
	previousClient, previousEnabled := common.RDB, common.RedisEnabled
	common.RDB, common.RedisEnabled = client, true
	t.Cleanup(func() { common.RDB, common.RedisEnabled = previousClient, previousEnabled; client.Close() })
	exportCtx, release, ok, err := AcquireLogExportLock(ctx, 903174)
	require.NoError(t, err)
	require.True(t, ok)
	defer release()
	_, _, ok, err = AcquireLogExportLock(ctx, 903174)
	require.NoError(t, err)
	require.False(t, ok)
	// A live export renews its lease instead of lapsing after a minute.
	require.NoError(t, client.PExpire(ctx, "log_export:903174", 50*time.Second).Err())
	require.Eventually(t, func() bool {
		return client.PTTL(ctx, "log_export:903174").Val() > 55*time.Second
	}, 25*time.Second, time.Second)
	// Releasing an old reservation must never delete another owner's lock.
	require.NoError(t, client.Set(ctx, "log_export:903174", "replacement-owner", time.Minute).Err())
	release()
	require.ErrorIs(t, exportCtx.Err(), context.Canceled)
	require.Equal(t, "replacement-owner", client.Get(ctx, "log_export:903174").Val())
	require.NoError(t, client.Del(ctx, "log_export:903174").Err())
}

func TestLogExportLockSingleUserAndIdempotentRelease(t *testing.T) {
	previous := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previous })
	_, release, ok, err := AcquireLogExportLock(context.Background(), 731)
	require.NoError(t, err)
	require.True(t, ok)
	defer release()
	_, _, ok, err = AcquireLogExportLock(context.Background(), 731)
	require.NoError(t, err)
	require.False(t, ok)
	_, other, ok, err := AcquireLogExportLock(context.Background(), 732)
	require.NoError(t, err)
	require.True(t, ok)
	other()
	release()
	release()
	_, next, ok, err := AcquireLogExportLock(context.Background(), 731)
	require.NoError(t, err)
	require.True(t, ok)
	next()
}
