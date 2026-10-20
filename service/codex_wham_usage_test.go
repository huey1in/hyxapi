package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCodexWhamRequestsDoNotFollowRedirectOrRetryReset(t *testing.T) {
	redirects, resets := 0, 0
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { redirects++ }))
	defer destination.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resets++
		http.Redirect(w, r, destination.URL, http.StatusTemporaryRedirect)
	}))
	defer origin.Close()
	status, _, err := ConsumeCodexWhamRateLimitResetCredit(context.Background(), origin.Client(), origin.URL, "token", "account")
	require.NoError(t, err)
	require.Equal(t, http.StatusTemporaryRedirect, status)
	require.Equal(t, 0, redirects)
	require.Equal(t, 1, resets)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, _, err = FetchCodexWhamUsage(ctx, origin.Client(), origin.URL, "token", "account")
	require.Error(t, err)
	require.Equal(t, 1, resets)
}

func TestCodexWhamResponseSizeIsBounded(t *testing.T) {
	body, err := readCodexWhamBody(strings.NewReader(strings.Repeat("x", (2<<20)+1)))
	require.ErrorContains(t, err, "size limit")
	require.Nil(t, body)
	body, err = readCodexWhamBody(strings.NewReader(`{"available_count":0}`))
	require.NoError(t, err)
	require.Equal(t, `{"available_count":0}`, string(body))
}
