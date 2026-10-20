package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestMetadataFetchUsesOnlyValidCacheAndHonorsCancellation(t *testing.T) {
	t.Setenv("SYNC_HTTP_RETRY", "1")
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			w.Header().Set("ETag", `"invalid"`)
			_, _ = w.Write([]byte(`{"data":`))
			return
		}
		if r.Header.Get("If-None-Match") != "" {
			require.Equal(t, `"valid"`, r.Header.Get("If-None-Match"))
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", `"valid"`)
		_, _ = w.Write([]byte(`[{"model_name":"valid-model"}]`))
	}))
	defer server.Close()
	var result upstreamEnvelope[upstreamModel]
	require.Error(t, fetchJSON(context.Background(), server.URL, &result))
	require.NoError(t, fetchJSON(context.Background(), server.URL, &result))
	require.NoError(t, fetchJSON(context.Background(), server.URL, &result))
	require.Equal(t, "valid-model", result.Data[0].ModelName)
	t.Setenv("SYNC_HTTP_RETRY", "8")
	failure := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusServiceUnavailable) }))
	defer failure.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	start := time.Now()
	err := fetchJSON(ctx, failure.URL, &result)
	require.True(t, errors.Is(err, context.DeadlineExceeded), err)
	require.Less(t, time.Since(start), time.Second, "cancelled sync must not wait through exponential retry delays")
}
