package service

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestLeaderboardProjectionPublishesUsernamesWithoutIdentityOrPrivateModels(t *testing.T) {
	rows := []model.LeaderboardUsage{
		{UserID: 713, Username: "alice", ModelName: "gpt-public", Requests: 3, Tokens: 900},
		{UserID: 713, Username: "alice", ModelName: "private-customer@example.com", Requests: 1, Tokens: 100},
		{UserID: 824, Username: "bob", ModelName: "gpt-public", Requests: 5, Tokens: 100},
		{UserID: 935, Username: "hidden@example.com", ModelName: "private-secret", Requests: 1, Tokens: 10},
	}
	public := map[string]bool{"gpt-public": true}
	result := projectLeaderboard(rows, public, 824, "tokens")
	require.Equal(t, 3, result.ActiveUsers)
	require.EqualValues(t, 1110, result.Tokens)
	require.EqualValues(t, 10, result.Requests)
	require.Equal(t, "alice", result.Users[0].Username)
	require.Equal(t, "bob", result.Users[1].Username)
	require.Equal(t, 2, *result.MyRank)
	require.False(t, result.Users[0].IsMe)
	require.True(t, result.Users[1].IsMe)
	require.Equal(t, "Anonymous member", result.Users[2].Username)
	require.InDelta(t, .75, result.Users[0].Preferences[0].Share, .0001)
	require.Equal(t, "", result.Users[0].Preferences[1].ModelName)
	encoded, err := json.Marshal(result)
	require.NoError(t, err)
	for _, sensitive := range []string{"example.com", "private-secret", "user_id", "email", "ip", "quota", "713", "824", "935"} {
		require.NotContains(t, string(encoded), sensitive)
	}
	byRequests := projectLeaderboard(rows, public, 713, "requests")
	require.Equal(t, "bob", byRequests.Users[0].Username)
	require.Equal(t, 2, *byRequests.MyRank)
	require.True(t, byRequests.Users[1].IsMe)
	require.False(t, byRequests.Users[0].IsMe)
	// A second viewer's projection must not mutate the cached source rows.
	require.Equal(t, rows[1].ModelName, "private-customer@example.com")
}

func TestLeaderboardBoundsResultsAndKeepsOwnRankOutsideTopHundred(t *testing.T) {
	rows := make([]model.LeaderboardUsage, 125)
	for index := range rows {
		rows[index] = model.LeaderboardUsage{UserID: index + 1, Username: fmt.Sprintf("member-%d", index), ModelName: "public", Requests: 1, Tokens: 100}
	}
	for _, metric := range []string{"tokens", "requests"} {
		for _, viewerID := range []int{100, 101, 125} {
			result := projectLeaderboard(rows, map[string]bool{"public": true}, viewerID, metric)
			require.Len(t, result.Users, 100)
			require.Equal(t, viewerID, *result.MyRank)
			require.Equal(t, 125, result.ActiveUsers)
			require.EqualValues(t, 125, result.Requests)
			require.EqualValues(t, 12500, result.Tokens)
			for index, user := range result.Users {
				require.Equal(t, index+1, user.Rank)
				require.Equal(t, index+1 == viewerID, user.IsMe)
				require.LessOrEqual(t, len(user.Preferences), 3)
			}
		}
	}
	empty := projectLeaderboard(nil, nil, 1, "tokens")
	require.Empty(t, empty.Users)
	require.NotNil(t, empty.Users)
	require.NotNil(t, empty.Models)
	require.Nil(t, empty.MyRank)
}

func TestLeaderboardRangesUseFixedBeijingCalendarBoundaries(t *testing.T) {
	now := time.Date(2026, 10, 24, 17, 0, 0, 0, time.UTC)
	for _, test := range []struct{ period, want string }{
		{"today", "2026-10-24T16:00:00Z"},
		{"week", "2026-10-18T16:00:00Z"},
		{"month", "2026-09-25T16:00:00Z"},
	} {
		start, err := leaderboardStart(test.period, now)
		require.NoError(t, err)
		require.Equal(t, test.want, time.Unix(start, 0).UTC().Format(time.RFC3339))
	}
	_, err := leaderboardStart("custom", now)
	require.Error(t, err)
}
