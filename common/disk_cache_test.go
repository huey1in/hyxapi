package common

import (
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCacheMaintenancePreservesActiveFilesAndCapacity(t *testing.T) {
	previous := GetDiskCacheConfig()
	SetDiskCacheConfig(DiskCacheConfig{Enabled: true, Path: t.TempDir(), ThresholdMB: 1, MaxSizeMB: 1})
	before := GetDiskCacheStats()
	t.Cleanup(func() {
		SetDiskCacheConfig(previous)
		atomic.StoreInt64(&diskCacheStats.DiskCacheHits, before.DiskCacheHits)
		atomic.StoreInt64(&diskCacheStats.MemoryCacheHits, before.MemoryCacheHits)
	})
	body, err := newDiskStorage([]byte("active payload"), "")
	require.NoError(t, err)
	t.Cleanup(func() { body.Close() })
	memory := newMemoryStorage([]byte("active memory"))
	t.Cleanup(func() { memory.Close() })
	filePath, err := WriteDiskCacheFileString(DiskCacheTypeFile, "active file")
	require.NoError(t, err)
	t.Cleanup(func() { os.Remove(filePath); ReleaseDiskCacheFile(filePath) })
	orphan := filepath.Join(GetDiskCacheDir(), "body-orphan.tmp")
	unrelated := filepath.Join(GetDiskCacheDir(), "keep.txt")
	for _, path := range []string{orphan, unrelated} {
		require.NoError(t, os.WriteFile(path, []byte("old"), 0600))
	}
	old := time.Now().Add(-time.Hour)
	for _, path := range []string{body.filePath, filePath, orphan, unrelated} {
		require.NoError(t, os.Chtimes(path, old, old))
	}
	IncrementDiskCacheHits()
	IncrementMemoryCacheHits()
	active := GetDiskCacheStats()
	ResetDiskCacheStats()
	require.NoError(t, CleanupOldDiskCacheFiles(10*time.Minute))
	after := GetDiskCacheStats()
	require.Zero(t, after.DiskCacheHits)
	require.Zero(t, after.MemoryCacheHits)
	require.Equal(t, active.ActiveDiskFiles, after.ActiveDiskFiles)
	require.Equal(t, active.CurrentDiskUsageBytes, after.CurrentDiskUsageBytes)
	require.Equal(t, active.ActiveMemoryBuffers, after.ActiveMemoryBuffers)
	require.Equal(t, active.CurrentMemoryUsageBytes, after.CurrentMemoryUsageBytes)
	require.False(t, IsDiskCacheAvailable(1<<20), "active allocations still count after reset")
	require.FileExists(t, body.filePath)
	require.FileExists(t, filePath, "closed file descriptors may still have an active FileSource owner")
	require.NoFileExists(t, orphan)
	require.FileExists(t, unrelated)
	payload, err := body.Bytes()
	require.NoError(t, err)
	require.Equal(t, "active payload", string(payload))
	require.NoError(t, body.Close())
	require.NoError(t, memory.Close())
	after = GetDiskCacheStats()
	require.Equal(t, before.ActiveDiskFiles, after.ActiveDiskFiles)
	require.Equal(t, before.CurrentDiskUsageBytes, after.CurrentDiskUsageBytes)
	require.Equal(t, before.ActiveMemoryBuffers, after.ActiveMemoryBuffers)
	require.Equal(t, before.CurrentMemoryUsageBytes, after.CurrentMemoryUsageBytes)
}
