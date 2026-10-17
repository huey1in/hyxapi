package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const logExportLockTTL = time.Minute

const logExportLockRenewScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0`

const logExportLockReleaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`

// logExportLocks holds the running exports when Redis is disabled.
var logExportLocks sync.Map

// AcquireLogExportLock reserves the one log export a user may run at a time.
// With Redis the reservation spans all nodes and lapses within a minute if
// this node dies. ok is false while another export of the user is running;
// otherwise release must be called when the export ends.
func AcquireLogExportLock(ctx context.Context, userId int) (exportCtx context.Context, release func(), ok bool, err error) {
	if !common.RedisEnabled {
		if _, running := logExportLocks.LoadOrStore(userId, struct{}{}); running {
			return nil, nil, false, nil
		}
		var once sync.Once
		return ctx, func() { once.Do(func() { logExportLocks.Delete(userId) }) }, true, nil
	}

	key := fmt.Sprintf("log_export:%d", userId)
	owner := common.GetRandomString(16)
	redisClient := common.RDB
	acquireCtx, acquireCancel := context.WithTimeout(ctx, 5*time.Second)
	acquired, err := redisClient.SetNX(acquireCtx, key, owner, logExportLockTTL).Result()
	acquireCancel()
	if err != nil || !acquired {
		return nil, nil, false, err
	}

	exportCtx, cancel := context.WithCancel(ctx)
	go func() {
		ticker := time.NewTicker(logExportLockTTL / 3)
		defer ticker.Stop()
		for {
			select {
			case <-exportCtx.Done():
				return
			case <-ticker.C:
				renewCtx, renewCancel := context.WithTimeout(exportCtx, 5*time.Second)
				renewed, err := redisClient.Eval(renewCtx, logExportLockRenewScript, []string{key}, owner, logExportLockTTL.Milliseconds()).Int()
				renewCancel()
				if err != nil || renewed != 1 {
					// Stop emitting rows before the reservation can expire and
					// another instance is allowed to start the same user's export.
					cancel()
					return
				}
			}
		}
	}()
	var once sync.Once
	return exportCtx, func() {
		once.Do(func() {
			cancel()
			releaseCtx, releaseCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer releaseCancel()
			redisClient.Eval(releaseCtx, logExportLockReleaseScript, []string{key}, owner)
		})
	}, true, nil
}
