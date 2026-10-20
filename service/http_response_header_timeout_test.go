package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestRelayResponseHeaderTimeoutPreservesStreamingBody(t *testing.T) {
	previousHeader, previousTotal := common.RelayResponseHeaderTimeout, common.RelayTimeout
	t.Cleanup(func() { common.RelayResponseHeaderTimeout, common.RelayTimeout = previousHeader, previousTotal })
	common.RelayResponseHeaderTimeout, common.RelayTimeout = 1, 0
	transport := newRelayHTTPTransport()
	defer transport.CloseIdleConnections()
	client := newRelayHTTPClient(transport)
	require.Equal(t, time.Second, transport.ResponseHeaderTimeout)
	require.Zero(t, client.Timeout)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/headers" {
			<-r.Context().Done()
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		time.Sleep(1200 * time.Millisecond)
		_, _ = io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer server.Close()
	_, err := client.Get(server.URL + "/headers")
	require.ErrorContains(t, err, "timeout awaiting response headers")
	resp, err := client.Get(server.URL + "/stream")
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	require.NoError(t, err)
	require.Contains(t, string(body), "[DONE]")
	for _, seconds := range []int{0, -1} {
		common.RelayResponseHeaderTimeout = seconds
		disabled := newRelayHTTPTransport()
		require.Zero(t, disabled.ResponseHeaderTimeout)
		disabled.CloseIdleConnections()
	}
}
