package gemini

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestGeminiModelDiscoveryEscapesPageTokensAndRejectsPartialLists(t *testing.T) {
	loop := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != "fixture" {
			t.Error("missing model discovery key")
		}
		if r.URL.Query().Get("pageToken") == "" || loop {
			_, _ = w.Write([]byte(`{"models":[{"name":"models/first"}],"nextPageToken":"a+b&c=?"}`))
		} else {
			if r.URL.Query().Get("pageToken") != "a+b&c=?" {
				t.Error("page token was not preserved")
			}
			_, _ = w.Write([]byte(`{"models":[{"name":"models/second"}]}`))
		}
	}))
	defer server.Close()
	models, err := FetchGeminiModelsWithContext(context.Background(), server.URL, "fixture", dto.ChannelSettings{})
	require.NoError(t, err)
	require.Equal(t, []string{"first", "second"}, models)
	loop = true
	models, err = FetchGeminiModelsWithContext(context.Background(), server.URL, "fixture", dto.ChannelSettings{})
	require.ErrorContains(t, err, "repeated a page token")
	require.Nil(t, models)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = FetchGeminiModelsWithContext(ctx, server.URL, "fixture", dto.ChannelSettings{})
	require.Error(t, err)
}
