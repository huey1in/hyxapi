package controller

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func balanceCustomChannel(t *testing.T, baseURL string) *model.Channel {
	t.Helper()
	channel := &model.Channel{Type: constant.ChannelTypeAdvancedCustom, Name: "balance fixture", Key: "fixture-secret", BaseURL: &baseURL, Balance: 31, Status: 1}
	channel.SetOtherSettings(dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{Routes: []dto.AdvancedCustomRoute{{IncomingPath: dto.AdvancedCustomBalancePath, UpstreamPath: "/provider/balance?existing=1", Auth: &dto.AdvancedCustomRouteAuth{Type: dto.AdvancedCustomAuthTypeQuery, Name: "token", Value: "prefix-{api_key}"}}}}})
	require.NoError(t, model.DB.Create(channel).Error)
	return channel
}

func TestAdvancedBalanceNumericZeroAndRawJSON(t *testing.T) {
	for _, raw := range []bool{false, true} {
		t.Run(map[bool]string{false: "numeric zero", true: "raw JSON"}[raw], func(t *testing.T) {
			setupSub2APIBalanceTest(t)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "/provider/balance", r.URL.Path)
				require.Equal(t, "prefix-fixture-secret", r.URL.Query().Get("token"))
				require.Equal(t, "1", r.URL.Query().Get("existing"))
				require.Equal(t, "custom-value", r.Header.Get("X-Balance"))
				if raw {
					_, _ = w.Write([]byte(`{"remaining":"unlimited","html":"<script>fixture</script>"}`))
				} else {
					_, _ = w.Write([]byte(`{"object":"credit_summary","total_available":0}`))
				}
			}))
			defer server.Close()
			channel := balanceCustomChannel(t, server.URL)
			header := `{"X-Balance":"custom-value"}`
			channel.HeaderOverride = &header
			require.NoError(t, model.DB.Model(channel).Update("header_override", header).Error)
			result, err := updateChannelBalance(context.Background(), channel)
			require.NoError(t, err)
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			if raw {
				require.True(t, json.Valid([]byte(result.RawResponse)))
				require.EqualValues(t, 31, stored.Balance)
				require.Zero(t, stored.BalanceUpdatedTime)
			} else {
				require.Empty(t, result.RawResponse)
				require.Zero(t, stored.Balance)
				require.Positive(t, stored.BalanceUpdatedTime)
			}
		})
	}
}

func TestAdvancedBalanceRejectsInvalidOversizeAndRedirect(t *testing.T) {
	for _, kind := range []string{"invalid", "oversize", "redirect"} {
		t.Run(kind, func(t *testing.T) {
			setupSub2APIBalanceTest(t)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch kind {
				case "invalid":
					_, _ = w.Write([]byte(`not JSON`))
				case "oversize":
					_, _ = w.Write([]byte(`{"x":"` + strings.Repeat("x", maxAdvancedCustomBalanceResponseBytes) + `"}`))
				case "redirect":
					http.Redirect(w, r, "/must-not-follow", http.StatusFound)
				}
			}))
			defer server.Close()
			channel := balanceCustomChannel(t, server.URL)
			_, err := updateChannelBalance(context.Background(), channel)
			require.Error(t, err)
			require.NotContains(t, err.Error(), channel.Key)
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.EqualValues(t, 31, stored.Balance)
		})
	}
}

func TestBalanceCommitProtectsCredentialsAndPreservesLiveFields(t *testing.T) {
	for _, change := range []string{"credential", "live fields", "database failure"} {
		t.Run(change, func(t *testing.T) {
			setupSub2APIBalanceTest(t)
			channel := newSub2APITestChannel(t, "http://fixture.invalid")
			switch change {
			case "credential":
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("key", "rotated-secret").Error)
			case "live fields":
				require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{"used_quota": 1234, "models": "new-model", "name": "edited"}).Error)
			case "database failure":
				require.NoError(t, model.DB.Exec("CREATE TEMP TRIGGER balance_fixture_failure BEFORE UPDATE OF balance ON channels BEGIN SELECT RAISE(ABORT,'fixture balance failure'); END").Error)
			}
			err := model.CommitChannelBalanceSnapshot(context.Background(), channel, 12.5)
			if change == "credential" {
				require.ErrorIs(t, err, model.ErrChannelBalanceChanged)
			} else if change == "database failure" {
				require.ErrorContains(t, err, "fixture balance failure")
			} else {
				require.NoError(t, err)
			}
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			if change == "live fields" {
				require.EqualValues(t, 12.5, stored.Balance)
				require.EqualValues(t, 1234, stored.UsedQuota)
				require.Equal(t, "new-model", stored.Models)
				require.Equal(t, "edited", stored.Name)
			} else {
				require.Zero(t, stored.Balance)
				require.Zero(t, channel.BalanceUpdatedTime)
			}
		})
	}
	setupSub2APIBalanceTest(t)
	channel := newSub2APITestChannel(t, "http://fixture.invalid")
	for _, value := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		require.Error(t, model.CommitChannelBalanceSnapshot(context.Background(), channel, value))
	}
}

func TestBalanceQueryCancellation(t *testing.T) {
	setupSub2APIBalanceTest(t)
	canceled := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.(http.Flusher).Flush()
		<-r.Context().Done()
		canceled <- struct{}{}
	}))
	defer server.Close()
	channel := balanceCustomChannel(t, server.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	_, err := updateChannelBalance(ctx, channel)
	require.Error(t, err)
	select {
	case <-canceled:
	case <-time.After(time.Second):
		t.Fatal("upstream request was not canceled")
	}
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.EqualValues(t, 31, stored.Balance)
}

func TestBalanceSweepPreservesRawJSONAndReportsFailures(t *testing.T) {
	setupSub2APIBalanceTest(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`{"remaining":"unlimited"}`)) }))
	defer server.Close()
	channel := balanceCustomChannel(t, server.URL)
	failure := &model.Channel{Type: constant.ChannelTypeAzure, Name: "unsupported", Status: 1}
	skipped := &model.Channel{Type: constant.ChannelTypeTaskPlugin, Name: "plugin", Status: 1}
	require.NoError(t, model.DB.Create(failure).Error)
	require.NoError(t, model.DB.Create(skipped).Error)
	summary, err := queryAllChannelsBalance(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, summary.RawResponses)
	require.Zero(t, summary.Updated)
	require.Equal(t, 1, summary.Skipped)
	require.Equal(t, []int{failure.Id}, summary.FailedChannelIDs)
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, 1, stored.Status)
	require.EqualValues(t, 31, stored.Balance)
	require.Zero(t, stored.BalanceUpdatedTime)
}
