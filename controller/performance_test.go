package controller

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestLogCleanupRetentionAndInvalidParameters(t *testing.T) {
	dir := t.TempDir()
	previous := *common.LogDir
	*common.LogDir = dir
	t.Cleanup(func() { *common.LogDir = previous })
	old := time.Now().Add(-7 * 24 * time.Hour)
	for _, name := range []string{"oneapi-20260101.log", "oneapi-20260102.log", "oneapi-20260103.log", "keep.log"} {
		path := filepath.Join(dir, name)
		require.NoError(t, os.WriteFile(path, []byte("log"), 0600))
		require.NoError(t, os.Chtimes(path, old, old))
	}
	require.NoError(t, os.Mkdir(filepath.Join(dir, "oneapi-directory.log"), 0700))
	files, err := getLogFiles()
	require.NoError(t, err)
	require.Len(t, files, 3)
	require.Equal(t, "oneapi-20260103.log", files[0].Name)
	call := func(query string) (bool, int64) {
		t.Helper()
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodDelete, "/api/performance/logs?"+query, nil)
		CleanupLogFiles(c)
		var response struct {
			Success bool `json:"success"`
			Data    struct {
				DeletedCount int64 `json:"deleted_count"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		return response.Success, response.Data.DeletedCount
	}
	for _, query := range []string{"mode=all&value=1", "mode=by_days&value=-1", "mode=by_count&value=1.5", "mode=by_days&value=999999999999999"} {
		success, _ := call(query)
		require.False(t, success, query)
	}
	success, count := call("mode=by_count&value=1")
	require.True(t, success)
	require.EqualValues(t, 2, count)
	require.FileExists(t, filepath.Join(dir, "oneapi-20260103.log"))
	success, count = call("mode=by_days&value=1")
	require.True(t, success)
	require.EqualValues(t, 1, count)
	require.FileExists(t, filepath.Join(dir, "keep.log"))
	require.DirExists(t, filepath.Join(dir, "oneapi-directory.log"))
}
