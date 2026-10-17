package model

import (
	"context"
	"github.com/stretchr/testify/require"
	"strings"
	"testing"
)

func TestLogExportScopesFiltersAndFixedBoundary(t *testing.T) {
	truncateTables(t)
	logs := make([]Log, 507)
	for i := range logs {
		logs[i] = Log{UserId: 71, CreatedAt: 100, Type: LogTypeConsume, ModelName: "model", Other: `{"admin_info":{"key":"secret"},"cache_tokens":5}`}
	}
	logs[0].UserId = 72
	logs[1].ModelName = "other"
	require.NoError(t, LOG_DB.Create(&logs).Error)
	count := 0
	err := StreamLogs(context.Background(), LogFilter{Type: LogTypeConsume, ModelName: "model", StartTimestamp: 90, EndTimestamp: 110}, 71, func(entry *Log) error {
		count++
		require.Equal(t, 71, entry.UserId)
		require.False(t, strings.Contains(entry.Other, "secret"))
		if count == 1 {
			require.NoError(t, LOG_DB.Create(&Log{UserId: 71, CreatedAt: 100, Type: LogTypeConsume, ModelName: "model"}).Error)
		}
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, 505, count)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.Error(t, StreamLogs(ctx, LogFilter{}, 71, func(*Log) error { t.Fatal("canceled export wrote a row"); return nil }))
}
