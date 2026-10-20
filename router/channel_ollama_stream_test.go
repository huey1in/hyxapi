package router

import (
	"bufio"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOllamaProgressFlushesBeforeDownloadFinishesWithGzipClient(t *testing.T) {
	router := gin.New()
	router.Use(apiCompression())
	finished := make(chan struct{})
	router.POST("/api/channel/ollama/pull/stream", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		_, _ = c.Writer.WriteString("data: progress\n\n")
		c.Writer.Flush()
		select {
		case <-finished:
		case <-c.Request.Context().Done():
		}
	})
	router.GET("/api/plain", func(c *gin.Context) { c.String(http.StatusOK, "ordinary response") })
	server := httptest.NewServer(router)
	defer server.Close()
	defer close(finished)
	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/channel/ollama/pull/stream", nil)
	require.NoError(t, err)
	request.Header.Set("Accept-Encoding", "gzip")
	client := &http.Client{Timeout: 2 * time.Second}
	response, err := client.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Empty(t, response.Header.Get("Content-Encoding"))
	line, err := bufio.NewReader(response.Body).ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "data: progress\n", line)

	// Ordinary API responses retain compression.
	recorder := httptest.NewRecorder()
	ordinary := httptest.NewRequest(http.MethodGet, "/api/plain", nil)
	ordinary.Header.Set("Accept-Encoding", "gzip")
	router.ServeHTTP(recorder, ordinary)
	require.Equal(t, "gzip", recorder.Header().Get("Content-Encoding"))
	reader, err := gzip.NewReader(recorder.Body)
	require.NoError(t, err)
	defer reader.Close()
	body, err := io.ReadAll(reader)
	require.NoError(t, err)
	require.Equal(t, "ordinary response", string(body))
}
