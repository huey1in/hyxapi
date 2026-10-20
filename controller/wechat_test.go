package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
)

func TestWeChatCodeLookupCancelsProviderRequest(t *testing.T) {
	started, cancelled := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("code") != "code&with=reserved" {
			t.Error("verification code was not escaped correctly")
		}
		close(started)
		<-r.Context().Done()
		close(cancelled)
	}))
	defer server.Close()
	previous := common.WeChatServerAddress
	common.WeChatServerAddress = server.URL
	t.Cleanup(func() { common.WeChatServerAddress = previous })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() { _, err := getWeChatIdByCode(ctx, "code&with=reserved"); result <- err }()
	select {
	case <-started:
	case <-time.After(time.Second * 5):
		t.Fatal("provider request did not start")
	}
	cancel()
	select {
	case err := <-result:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected cancellation, got %v", err)
		}
	case <-time.After(time.Second * 2):
		t.Fatal("provider request did not cancel promptly")
	}
	select {
	case <-cancelled:
	case <-time.After(time.Second * 2):
		t.Fatal("provider did not observe request cancellation")
	}
}
