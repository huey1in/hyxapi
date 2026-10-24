package model

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
)

// LeaderboardUsage is internal aggregation data, never an API response.
type LeaderboardUsage struct {
	UserID    int    `json:"-"`
	Username  string `json:"-"`
	ModelName string `json:"-"`
	Requests  int64  `json:"-"`
	Tokens    int64  `json:"-"`
}

func GetLeaderboardUsage(ctx context.Context, start, end int64) ([]LeaderboardUsage, error) {
	if start < 0 || end < start || end-start > 31*86400 {
		return nil, errors.New("invalid leaderboard range")
	}
	// The user database and log database may be separate. Fetch only the two
	// identity columns needed for eligible members, then aggregate in LOG_DB.
	var users []struct {
		ID       int
		Username string
	}
	if err := DB.WithContext(ctx).Model(&User{}).Select("id, username").
		Where("role IN ? AND status = ?", []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleRootUser}, common.UserStatusEnabled).
		Find(&users).Error; err != nil {
		return nil, err
	}
	result := make([]LeaderboardUsage, 0)
	// Bound SQL parameter counts for SQLite and large installations.
	for offset := 0; offset < len(users); offset += 500 {
		batch := users[offset:min(offset+500, len(users))]
		ids := make([]int, 0, len(batch))
		names := make(map[int]string, len(batch))
		for _, user := range batch {
			ids = append(ids, user.ID)
			names[user.ID] = user.Username
		}
		var rows []LeaderboardUsage
		err := LOG_DB.WithContext(ctx).Model(&Log{}).
			Select("user_id, model_name, COUNT(*) AS requests, COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS tokens").
			Where("type = ? AND created_at >= ? AND created_at <= ? AND user_id IN ?", LogTypeConsume, start, end, ids).
			Group("user_id, model_name").Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			row.Username = names[row.UserID]
			row.Tokens = max(0, row.Tokens)
			result = append(result, row)
		}
	}
	return result, nil
}
