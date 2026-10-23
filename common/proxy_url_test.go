package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProxyURLRejectsIgnoredAddressComponents(t *testing.T) {
	for _, suffix := range []string{"/proxy", "/%2f", "?", "?token=secret", "#", "#fragment"} {
		_, err := ParseProxyURL("http://localhost:8080" + suffix)
		require.Error(t, err, suffix)
	}
	for raw, want := range map[string]string{
		" http://localhost:8080/ ": "http://localhost:8080",
		"socks5://localhost":       "socks5://localhost:1080",
		"socks5h://[::1]":          "socks5h://[::1]:1080",
	} {
		parsed, err := ParseProxyURL(raw)
		require.NoError(t, err)
		require.Equal(t, want, parsed.String())
	}
}
