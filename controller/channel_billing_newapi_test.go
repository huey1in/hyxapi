package controller

import (
	"fmt"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewAPIBalanceUsesSmallerOwnerQuotaAndUpstreamUnits(t *testing.T) {
	for _, tc := range []struct {
		unlimited bool
		owner     string
		balance   float64
		wantError bool
	}{
		{false, `,"user_quota":{"total_available":200}`, 0.2, false},
		{false, "", 0.5, false}, {true, `,"user_quota":{"total_available":2000}`, 2, false}, {true, "", 0, true},
	} {
		t.Run(fmt.Sprintf("%t-%s", tc.unlimited, tc.owner), func(t *testing.T) {
			setupSub2APIBalanceTest(t)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/api/status" {
					fmt.Fprint(w, `{"data":{"quota_per_unit":1000}}`)
					return
				}
				require.Equal(t, "/api/usage/token/", r.URL.Path)
				fmt.Fprintf(w, `{"code":true,"data":{"total_available":500,"unlimited_quota":%t%s}}`, tc.unlimited, tc.owner)
			}))
			defer server.Close()
			channel := newSub2APITestChannel(t, server.URL)
			channel.Type = constant.ChannelTypeNewAPI
			balance, err := updateChannelNewAPIBalance(channel)
			if tc.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.InDelta(t, tc.balance, balance, 1e-9)
			}
		})
	}
}
