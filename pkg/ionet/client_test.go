package ionet

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestClientUsesContextBoundsAndRejectsRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cancel":
			<-r.Context().Done()
		case "/oversized":
			w.Write([]byte(strings.Repeat("x", MaxResponseBytes+1)))
		case "/redirect":
			http.Redirect(w, r, "/unexpected", http.StatusTemporaryRedirect)
		case "/unexpected":
			t.Error("request followed a redirect")
		default:
			require.Equal(t, "fixture", r.Header.Get("X-API-KEY"))
			w.Write([]byte(`{"detail":"not available"}`))
		}
	}))
	defer server.Close()
	client := NewClientWithConfig("fixture", server.URL, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := client.WithContext(ctx).makeRequest("GET", "/cancel", nil)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	_, err = client.makeRequest("GET", "/oversized", nil)
	require.ErrorContains(t, err, "response exceeds")
	_, err = client.makeRequest("POST", "/redirect", map[string]any{"name": "never repeat"})
	var apiError *APIError
	require.True(t, errors.As(err, &apiError))
	require.Equal(t, http.StatusTemporaryRedirect, apiError.Code)
}

func TestDeploymentSDKQuotesRawLogsAndEncodedResourceIDs(t *testing.T) {
	var priceQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "fixture", r.Header.Get("X-API-KEY"))
		if r.URL.Path == "/price" {
			priceQuery = r.URL.RawQuery
			w.Write([]byte(`{"data":{"total_cost_usdc":48,"ionet_fee":2}}`))
			return
		}
		require.Contains(t, r.RequestURI, "deployment%2Fwith%3Fquery")
		require.Contains(t, r.RequestURI, "container%23id")
		require.Equal(t, "100", r.URL.Query().Get("limit"))
		w.Write([]byte("first line\nsecond line\n"))
	}))
	defer server.Close()
	client := NewClientWithConfig("fixture", server.URL, nil)
	quote, err := client.GetPriceEstimation(&PriceEstimationRequest{LocationIDs: []int{1, 2}, HardwareID: 3, GPUsPerContainer: 2, ReplicaCount: 2, DurationType: "day", DurationQty: 1})
	require.NoError(t, err)
	require.Equal(t, 48.0, quote.EstimatedCost)
	require.Equal(t, 2.0, quote.PriceBreakdown.HourlyRate)
	require.Contains(t, priceQuery, "duration_type=daily")
	require.Contains(t, priceQuery, "location_ids=%5B1%2C2%5D")
	logs, err := client.GetContainerLogsRaw("deployment/with?query", "container#id", &GetLogsOptions{Limit: 100})
	require.NoError(t, err)
	require.Equal(t, "first line\nsecond line\n", logs)
}

func TestPriceResponseRequiresExplicitCostIncludingZero(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) == 1 {
			w.Write([]byte(`{"data":{}}`))
			return
		}
		w.Write([]byte(`{"data":{"total_cost_usdc":0}}`))
	}))
	defer server.Close()
	client := NewClientWithConfig("fixture", server.URL, nil)
	req := &PriceEstimationRequest{LocationIDs: []int{1}, HardwareID: 1, GPUsPerContainer: 1, ReplicaCount: 1, DurationHours: 1}
	_, err := client.GetPriceEstimation(req)
	require.ErrorContains(t, err, "total_cost_usdc")
	quote, err := client.GetPriceEstimation(req)
	require.NoError(t, err)
	require.True(t, quote.EstimationValid)
	require.Zero(t, quote.EstimatedCost)
}

func TestFlexibleTimesPreserveEnvironmentAndLargeNumbers(t *testing.T) {
	var decoded struct {
		CreatedAt time.Time      `json:"created_at"`
		Env       map[string]any `json:"env_variables"`
	}
	require.NoError(t, decodeWithFlexibleTimes([]byte(`{"created_at":"2026-10-19T12:00:00","env_variables":{"DATE":"2026-10-19T12:00:00","time":"2026-10-19T12:00:00"}}`), &decoded))
	require.Equal(t, time.UTC, decoded.CreatedAt.Location())
	require.Equal(t, "2026-10-19T12:00:00", decoded.Env["DATE"])
	require.Equal(t, "2026-10-19T12:00:00", decoded.Env["time"])
	var exact struct {
		ID int64 `json:"id"`
	}
	require.NoError(t, decodeWithFlexibleTimes([]byte(`{"id":9007199254740993}`), &exact))
	require.EqualValues(t, 9007199254740993, exact.ID)
}
