package ollama

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestOllamaManagementUsesSelectedTransportAndExplicitStreamFlag(t *testing.T) {
	posts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer fixture", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/api/tags":
			_, _ = w.Write([]byte(`{"models":[]}`))
		case "/api/version":
			_, _ = w.Write([]byte(`{"version":"fixture-1"}`))
		case "/api/pull":
			posts++
			var body map[string]any
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.Equal(t, false, body["stream"])
			require.Equal(t, "fixture:model", body["name"])
			_, _ = w.Write([]byte(`{"status":"success"}`))
		case "/api/delete":
			require.Equal(t, http.MethodDelete, r.Method)
		default:
			t.Errorf("unexpected management request: %s", r.URL.Path)
		}
	}))
	defer server.Close()
	httpClient := server.Client()
	httpClient.Timeout = time.Nanosecond
	client := ManagementClient{BaseURL: server.URL + "/", APIKey: "fixture", Client: httpClient}
	models, err := client.Models(context.Background())
	require.NoError(t, err)
	require.Empty(t, models)
	version, err := client.Version(context.Background())
	require.NoError(t, err)
	require.Equal(t, "fixture-1", version)
	require.NoError(t, client.Pull(context.Background(), "fixture:model", false, nil))
	require.NoError(t, client.Delete(context.Background(), "fixture:model"))
	require.Equal(t, 1, posts)
	require.Equal(t, time.Nanosecond, httpClient.Timeout, "the shared client must not be mutated")
}

func TestOllamaManagementStreamRequiresSuccessAndHonorsCancellation(t *testing.T) {
	for _, frame := range []string{"{bad json}\n", "{\"error\":\"fixture failure\"}\n", "{\"status\":\"downloading\"}\n"} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(frame)) }))
		client := ManagementClient{BaseURL: server.URL}
		require.Error(t, client.Pull(context.Background(), "fixture", true, nil), frame)
		server.Close()
	}
	canceled := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("{\"status\":\"downloading\",\"completed\":1,\"total\":2}\n"))
		w.(http.Flusher).Flush()
		<-r.Context().Done()
		close(canceled)
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	err := (ManagementClient{BaseURL: server.URL}).Pull(ctx, "fixture", true, func(OllamaPullResponse) { cancel() })
	require.ErrorIs(t, err, context.Canceled)
	select {
	case <-canceled:
	case <-time.After(3 * time.Second):
		t.Fatal("upstream download was not canceled")
	}
}

func TestOllamaManagementBoundsBodiesAndRefusesRedirects(t *testing.T) {
	_, err := readManagementBody(strings.NewReader(strings.Repeat("x", (2<<20)+1)))
	require.ErrorContains(t, err, "size limit")
	redirected := false
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { redirected = true }))
	defer destination.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL, http.StatusTemporaryRedirect)
	}))
	defer origin.Close()
	_, err = (ManagementClient{BaseURL: origin.URL, APIKey: "fixture"}).Models(context.Background())
	require.ErrorContains(t, err, "HTTP 307")
	require.False(t, redirected)
}
