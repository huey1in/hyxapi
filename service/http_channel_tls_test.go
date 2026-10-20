package service

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestChannelTLSOverrideHasIndependentReusableClientPools(t *testing.T) {
	previous := common.TLSInsecureSkipVerify
	common.TLSInsecureSkipVerify = false
	t.Cleanup(func() { common.TLSInsecureSkipVerify = previous; ResetProxyClientCache() })
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Fixture-Connection", r.RemoteAddr)
		_, _ = io.WriteString(w, r.Proto)
	}))
	server.EnableHTTP2 = true
	server.StartTLS()
	defer server.Close()
	for _, protocol := range []string{dto.HTTPProtocolAuto, dto.HTTPProtocolHTTP1} {
		for _, shards := range []int{1, 2} {
			if protocol == dto.HTTPProtocolHTTP1 && shards > 1 {
				continue
			}
			settings := dto.ChannelSettings{HTTPProtocol: protocol, HTTP2ConnectionShards: shards}
			strict, err := GetHttpClientWithProxySettings("", settings)
			require.NoError(t, err)
			_, err = strict.Get(server.URL)
			require.Error(t, err)
			settings.TLSInsecureSkipVerify = true
			insecure, err := GetHttpClientWithProxySettings("", settings)
			require.NoError(t, err)
			require.NotSame(t, strict, insecure)
			again, err := GetHttpClientWithProxySettings("", settings)
			require.NoError(t, err)
			require.Same(t, insecure, again)
			connections := make(map[string]bool)
			for range 4 {
				response, err := insecure.Get(server.URL)
				require.NoError(t, err)
				body, err := io.ReadAll(response.Body)
				require.NoError(t, err)
				require.NoError(t, response.Body.Close())
				expected := "HTTP/2.0"
				if protocol == dto.HTTPProtocolHTTP1 {
					expected = "HTTP/1.1"
				}
				require.Equal(t, expected, string(body))
				connections[response.Header.Get("X-Fixture-Connection")] = true
			}
			require.Len(t, connections, shards)
			// A permissive channel must never change the strict channel's pool.
			_, err = strict.Get(server.URL)
			require.Error(t, err)
		}
	}
}
