package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
	"golang.org/x/sync/singleflight"
)

type LeaderboardModel struct {
	ModelName string  `json:"model_name"`
	Requests  int64   `json:"requests"`
	Tokens    int64   `json:"tokens"`
	Share     float64 `json:"share"`
}

type LeaderboardUser struct {
	Rank        int                `json:"rank"`
	Username    string             `json:"username"`
	Requests    int64              `json:"requests"`
	Tokens      int64              `json:"tokens"`
	IsMe        bool               `json:"is_me"`
	Preferences []LeaderboardModel `json:"preferences"`
}

type Leaderboard struct {
	Period      string             `json:"period"`
	Metric      string             `json:"metric"`
	Timezone    string             `json:"timezone"`
	StartAt     int64              `json:"start_at"`
	UpdatedAt   int64              `json:"updated_at"`
	ActiveUsers int                `json:"active_users"`
	Requests    int64              `json:"requests"`
	Tokens      int64              `json:"tokens"`
	MyRank      *int               `json:"my_rank"`
	Users       []LeaderboardUser  `json:"users"`
	Models      []LeaderboardModel `json:"models"`
}

type leaderboardSnapshot struct {
	rows    []model.LeaderboardUsage
	start   int64
	updated time.Time
}

var leaderboardCache = struct {
	sync.RWMutex
	entries map[string]*leaderboardSnapshot
	loads   singleflight.Group
}{entries: make(map[string]*leaderboardSnapshot)}

// Fixed calendar ranges prevent arbitrary time windows from probing individual
// calls. Cache aggregated rows, never a response containing viewer-specific data.
func leaderboardStart(period string, now time.Time) (int64, error) {
	local := now.In(time.FixedZone("Asia/Shanghai", 8*3600))
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
	switch period {
	case "today":
	case "week":
		start = start.AddDate(0, 0, -6)
	case "month":
		start = start.AddDate(0, 0, -29)
	default:
		return 0, errors.New("invalid leaderboard period")
	}
	return start.Unix(), nil
}

func GetLeaderboard(ctx context.Context, period, metric string, viewerID int, publicModels map[string]bool) (*Leaderboard, error) {
	if viewerID <= 0 || (metric != "tokens" && metric != "requests") {
		return nil, errors.New("invalid leaderboard request")
	}
	start, err := leaderboardStart(period, time.Now())
	if err != nil {
		return nil, err
	}
	load := func() *leaderboardSnapshot {
		leaderboardCache.RLock()
		defer leaderboardCache.RUnlock()
		entry := leaderboardCache.entries[period]
		if entry != nil && entry.start == start && time.Since(entry.updated) < time.Minute {
			return entry
		}
		return nil
	}
	entry := load()
	if entry == nil {
		pending := leaderboardCache.loads.DoChan(period, func() (any, error) {
			if cached := load(); cached != nil {
				return cached, nil
			}
			// One cancelled HTTP request must not cancel the shared aggregation.
			queryCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			now := time.Now()
			rows, err := model.GetLeaderboardUsage(queryCtx, start, now.Unix())
			if err != nil {
				return nil, err
			}
			cached := &leaderboardSnapshot{rows: rows, start: start, updated: now}
			leaderboardCache.Lock()
			leaderboardCache.entries[period] = cached
			leaderboardCache.Unlock()
			return cached, nil
		})
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case result := <-pending:
			if result.Err != nil {
				return nil, result.Err
			}
			entry = result.Val.(*leaderboardSnapshot)
		}
	}
	result := projectLeaderboard(entry.rows, publicModels, viewerID, metric)
	result.Period, result.Metric, result.Timezone = period, metric, "Asia/Shanghai"
	result.StartAt, result.UpdatedAt = entry.start, entry.updated.Unix()
	return result, nil
}

func rankedModels(models map[string]*LeaderboardModel, total int64) []LeaderboardModel {
	result := make([]LeaderboardModel, 0, len(models))
	for _, item := range models {
		copy := *item
		if total > 0 {
			copy.Share = float64(copy.Requests) / float64(total)
		}
		result = append(result, copy)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Requests != result[j].Requests {
			return result[i].Requests > result[j].Requests
		}
		return result[i].ModelName < result[j].ModelName
	})
	return result
}

func projectLeaderboard(rows []model.LeaderboardUsage, publicModels map[string]bool, viewerID int, metric string) *Leaderboard {
	type member struct {
		LeaderboardUser
		id     int
		models map[string]*LeaderboardModel
	}
	members := make(map[int]*member)
	models := make(map[string]*LeaderboardModel)
	result := &Leaderboard{Users: []LeaderboardUser{}, Models: []LeaderboardModel{}}
	for _, row := range rows {
		user := members[row.UserID]
		if user == nil {
			username := row.Username
			// Some legacy accounts use an email address as their username.
			// Preserve normal usernames without publishing an email in disguise.
			if strings.ContainsAny(username, "@\r\n\t") || username == "" {
				username = "Anonymous member"
			}
			user = &member{LeaderboardUser: LeaderboardUser{Username: username, IsMe: row.UserID == viewerID}, id: row.UserID, models: make(map[string]*LeaderboardModel)}
			members[row.UserID] = user
		}
		user.Requests += row.Requests
		user.Tokens += row.Tokens
		result.Requests += row.Requests
		result.Tokens += row.Tokens
		name := row.ModelName
		if !publicModels[name] {
			name = "" // Private, removed and unknown model names stay private.
		}
		for _, target := range []map[string]*LeaderboardModel{user.models, models} {
			if target[name] == nil {
				target[name] = &LeaderboardModel{ModelName: name}
			}
			target[name].Requests += row.Requests
			target[name].Tokens += row.Tokens
		}
	}
	ordered := make([]*member, 0, len(members))
	for _, user := range members {
		ordered = append(ordered, user)
	}
	sort.Slice(ordered, func(i, j int) bool {
		a, b := ordered[i], ordered[j]
		if metric == "requests" && a.Requests != b.Requests {
			return a.Requests > b.Requests
		}
		if a.Tokens != b.Tokens {
			return a.Tokens > b.Tokens
		}
		if a.Requests != b.Requests {
			return a.Requests > b.Requests
		}
		return a.id < b.id
	})
	result.ActiveUsers = len(ordered)
	for index, user := range ordered {
		user.Rank = index + 1
		if user.IsMe {
			rank := user.Rank
			result.MyRank = &rank
		}
		if index < 100 {
			preferences := rankedModels(user.models, user.Requests)
			user.Preferences = preferences[:min(3, len(preferences))]
			result.Users = append(result.Users, user.LeaderboardUser)
		}
	}
	result.Models = rankedModels(models, result.Requests)
	result.Models = result.Models[:min(8, len(result.Models))]
	return result
}
