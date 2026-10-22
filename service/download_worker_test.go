package service

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

type downloadProbe func(*http.Request) (*http.Response, error)

func (p downloadProbe) RoundTrip(req *http.Request) (*http.Response, error) { return p(req) }

func TestDownloadWorkerUsesConfiguredPayloadAndRetainsFetchGuards(t *testing.T) {
	previousWorker := system_setting.WorkerSettingsSnapshot()
	previousFetch := *system_setting.GetFetchSetting()
	previousClient, previousProtected := httpClient, ssrfProtectedHTTPClient
	t.Cleanup(func() {
		system_setting.WorkerUrl, system_setting.WorkerValidKey, system_setting.WorkerAllowHttpImageRequestEnabled = previousWorker.URL, previousWorker.Key, previousWorker.AllowHTTP
		*system_setting.GetFetchSetting() = previousFetch
		httpClient, ssrfProtectedHTTPClient = previousClient, previousProtected
	})
	calls := 0
	var received WorkerRequest
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&received))
		_, _ = w.Write([]byte("worker image bytes"))
	}))
	defer worker.Close()
	httpClient = worker.Client()
	system_setting.WorkerUrl, system_setting.WorkerValidKey = worker.URL, "local-worker-secret"
	system_setting.WorkerAllowHttpImageRequestEnabled = false
	fetch := system_setting.GetFetchSetting()
	fetch.EnableSSRFProtection = false
	resp, err := DoDownloadRequest("https://example.org/image.png")
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	require.NoError(t, err)
	require.Equal(t, "worker image bytes", string(body))
	require.Equal(t, "https://example.org/image.png", received.URL)
	require.Equal(t, "local-worker-secret", received.Key)
	require.Equal(t, 1, calls)
	_, err = DoDownloadRequest("http://example.org/image.png")
	require.Error(t, err)
	require.Equal(t, 1, calls)
	system_setting.WorkerAllowHttpImageRequestEnabled = true
	resp, err = DoDownloadRequest("http://example.org/image.png")
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, 2, calls)
	fetch.EnableSSRFProtection, fetch.AllowPrivateIp = true, false
	fetch.AllowedPorts = []string{"80", "443"}
	_, err = DoDownloadRequest("https://127.0.0.1/private.png")
	require.Error(t, err)
	require.Equal(t, 2, calls, "blocked targets must never reach the worker")

	system_setting.WorkerUrl = ""
	protectedCalls := 0
	ssrfProtectedHTTPClient = &http.Client{Transport: downloadProbe(func(req *http.Request) (*http.Response, error) {
		protectedCalls++
		require.Equal(t, "https://8.8.8.8/image.png", req.URL.String())
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("direct")), Header: make(http.Header)}, nil
	})}
	resp, err = DoDownloadRequest("https://8.8.8.8/image.png")
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, 1, protectedCalls, "direct media must use the protected transport")
}

func TestDownloadWorkerDoesNotFollowRedirectsWithSecrets(t *testing.T) {
	previousClient := httpClient
	previousFetch := *system_setting.GetFetchSetting()
	t.Cleanup(func() { httpClient = previousClient; *system_setting.GetFetchSetting() = previousFetch })
	system_setting.GetFetchSetting().EnableSSRFProtection = false
	leaked := false
	other := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { leaked = true }))
	defer other.Close()
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, other.URL, http.StatusTemporaryRedirect)
	}))
	defer worker.Close()
	httpClient = worker.Client()
	resp, err := doWorkerRequest(&WorkerRequest{URL: "https://example.org/image.png", Key: "private-key"}, system_setting.WorkerSettings{URL: worker.URL})
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode)
	require.False(t, leaked)
	_, err = doWorkerRequest(nil, system_setting.WorkerSettings{URL: worker.URL})
	require.Error(t, err)
	_, err = doWorkerRequest(nil, system_setting.WorkerSettingsSnapshot())
	require.Error(t, err)
}
