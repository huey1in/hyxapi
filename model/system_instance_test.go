package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSystemInstanceHeartbeatAndStaleDeletion(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&SystemInstance{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&SystemInstance{}).Error)
	t.Cleanup(func() { DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&SystemInstance{}) })
	const now = int64(2000)
	require.NoError(t, UpsertSystemInstance("current", map[string]any{"version": "first"}, 100, now-200))
	var before SystemInstance
	require.NoError(t, DB.First(&before, "node_name = ?", "current").Error)
	// A restarted process reuses its stable node name and replaces its heartbeat.
	require.NoError(t, UpsertSystemInstance("current", map[string]any{"version": "second"}, 200, now))
	require.NoError(t, UpsertSystemInstance("boundary", nil, 100, now-SystemInstanceStaleAfterSeconds))
	require.NoError(t, UpsertSystemInstance("stale", nil, 100, now-SystemInstanceStaleAfterSeconds-1))
	instances, err := ListSystemInstances()
	require.NoError(t, err)
	require.Len(t, instances, 3)
	require.Equal(t, "current", instances[0].NodeName)
	require.EqualValues(t, 200, instances[0].StartedAt)
	require.Equal(t, before.CreatedAt, instances[0].CreatedAt)
	require.Equal(t, map[string]any{"version": "second"}, instances[0].ToResponse(now).Info)
	require.Equal(t, SystemInstanceStatusOnline, instances[1].ToResponse(now).Status)
	require.Equal(t, SystemInstanceStatusStale, instances[2].ToResponse(now).Status)
	deleted, err := DeleteStaleSystemInstance("current", now)
	require.NoError(t, err)
	require.False(t, deleted, "a heartbeat after the UI preview protects the live node")
	count, err := DeleteStaleSystemInstances(now)
	require.NoError(t, err)
	require.EqualValues(t, 1, count)
	instances, err = ListSystemInstances()
	require.NoError(t, err)
	require.Len(t, instances, 2)
}

func TestSystemInstanceInvalidInfoDoesNotReplaceHeartbeat(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&SystemInstance{}))
	t.Cleanup(func() { DB.Where("node_name = ?", "invalid-info").Delete(&SystemInstance{}) })
	require.NoError(t, UpsertSystemInstance("invalid-info", map[string]any{"ok": true}, 100, 2000))
	require.Error(t, UpsertSystemInstance("invalid-info", make(chan int), 200, 3000))
	require.Error(t, UpsertSystemInstance(" ", nil, 0, 0))
	require.Error(t, UpsertSystemInstance(strings.Repeat("n", 129), nil, 0, 0))
	var instance SystemInstance
	require.NoError(t, DB.First(&instance, "node_name = ?", "invalid-info").Error)
	require.EqualValues(t, 2000, instance.LastSeenAt)
	require.Equal(t, map[string]any{"ok": true}, instance.ToResponse(2000).Info)
}
