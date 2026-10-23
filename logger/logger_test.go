package logger

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLogCleanupProtectsActiveWriter(t *testing.T) {
	dir := t.TempDir()
	activePath := filepath.Join(dir, "oneapi-current.log")
	fd, err := os.Create(activePath)
	require.NoError(t, err)
	previous := currentLogFile
	currentLogFile = fd
	t.Cleanup(func() { currentLogFile = previous; fd.Close() })
	require.True(t, IsCurrentLogFile(activePath))
	deleted, err := RemoveInactiveLogFile(filepath.Join(dir, ".", "oneapi-current.log"))
	require.NoError(t, err)
	require.False(t, deleted)
	require.FileExists(t, activePath)
	_, err = fd.WriteString("still writing\n")
	require.NoError(t, err)
	old := filepath.Join(dir, "oneapi-old.log")
	require.NoError(t, os.WriteFile(old, []byte("old"), 0600))
	deleted, err = RemoveInactiveLogFile(old)
	require.NoError(t, err)
	require.True(t, deleted)
	require.NoFileExists(t, old)
	deleted, err = RemoveInactiveLogFile(dir)
	require.NoError(t, err)
	require.False(t, deleted)
}
