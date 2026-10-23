package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

type retirementProbe struct{ closed int }

func (p *retirementProbe) RoundTrip(*http.Request) (*http.Response, error) {
	panic("no network expected")
}
func (p *retirementProbe) CloseIdleConnections() { p.closed++ }

func TestInvalidateProxyRetiresAllPoliciesAndPreservesUnrelatedPools(t *testing.T) {
	proxyClients.mutex.Lock()
	previousClients, previousAliases := proxyClients.clients, proxyClients.aliases
	proxyClients.clients, proxyClients.aliases = make(map[string]*http.Client), make(map[string]string)
	proxyClients.mutex.Unlock()
	t.Cleanup(func() {
		proxyClients.mutex.Lock()
		proxyClients.clients, proxyClients.aliases = previousClients, previousAliases
		proxyClients.mutex.Unlock()
	})
	key, err := NormalizeProxyURL("http://127.0.0.1:8123")
	require.NoError(t, err)
	other, err := NormalizeProxyURL("http://127.0.0.1:8124")
	require.NoError(t, err)
	probes := make([]*retirementProbe, 0, 4)
	for _, policy := range []HTTPTransportPolicy{defaultHTTPTransportPolicy(), NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTPProtocol: dto.HTTPProtocolHTTP1}), NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTP2ConnectionShards: 3})} {
		probe := &retirementProbe{}
		probes = append(probes, probe)
		proxyClients.clients[clientCacheKey(key, policy)] = &http.Client{Transport: probe}
	}
	unrelated := &retirementProbe{}
	proxyClients.clients[clientCacheKey(other, defaultHTTPTransportPolicy())] = &http.Client{Transport: unrelated}
	proxyClients.aliases["root-slash-alias"] = key
	InvalidateProxyClient("http://127.0.0.1:8123/")
	for _, probe := range probes {
		require.Equal(t, 1, probe.closed)
	}
	require.Zero(t, unrelated.closed)
	require.Len(t, proxyClients.clients, 1)
	require.NotContains(t, proxyClients.aliases, "root-slash-alias")
	InvalidateProxyClient("")
	InvalidateProxyClient("not a proxy")
	require.Len(t, proxyClients.clients, 1)
	InvalidateProxyClient("http://127.0.0.1:8124")
	require.Equal(t, 1, unrelated.closed)
}
