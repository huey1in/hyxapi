package model

import (
	"context"

	"gorm.io/gorm"
)

// LogFilter is shared by paginated searches and keyset exports.
type LogFilter struct {
	Type, Channel                                    int
	StartTimestamp, EndTimestamp                     int64
	ModelName, Username, TokenName, Group, RequestId string
}

func buildLogQuery(f LogFilter, userID int) (*gorm.DB, error) {
	q := LOG_DB.Model(&Log{})
	if userID > 0 {
		q = q.Where("logs.user_id = ?", userID)
	}
	if f.Type != LogTypeUnknown {
		q = q.Where("logs.type = ?", f.Type)
	}
	if f.ModelName != "" {
		if userID > 0 {
			pattern, err := sanitizeLikePattern(f.ModelName)
			if err != nil {
				return nil, err
			}
			q = q.Where("logs.model_name LIKE ? ESCAPE '!'", pattern)
		} else {
			q = q.Where("logs.model_name LIKE ?", f.ModelName)
		}
	}
	for _, v := range []struct{ column, value string }{{"username", f.Username}, {"token_name", f.TokenName}, {"request_id", f.RequestId}} {
		if v.value != "" {
			q = q.Where("logs."+v.column+" = ?", v.value)
		}
	}
	if f.Group != "" {
		q = q.Where("logs."+logGroupCol+" = ?", f.Group)
	}
	if f.Channel != 0 {
		q = q.Where("logs.channel_id = ?", f.Channel)
	}
	if f.StartTimestamp != 0 {
		q = q.Where("logs.created_at >= ?", f.StartTimestamp)
	}
	if f.EndTimestamp != 0 {
		q = q.Where("logs.created_at <= ?", f.EndTimestamp)
	}
	return q, nil
}

// StreamLogs fixes an upper ID boundary and walks batches without OFFSET.
// New records cannot extend an export already in progress.
func StreamLogs(ctx context.Context, f LogFilter, userID int, write func(*Log) error) error {
	q, err := buildLogQuery(f, userID)
	if err != nil {
		return err
	}
	var ceiling int
	if err = q.WithContext(ctx).Select("COALESCE(MAX(logs.id), 0)").Scan(&ceiling).Error; err != nil {
		return err
	}
	count := 0
	for ceiling > 0 {
		var batch []*Log
		if err = q.WithContext(ctx).Where("logs.id <= ?", ceiling).Order("logs.id DESC").Limit(500).Find(&batch).Error; err != nil {
			return err
		}
		if len(batch) == 0 {
			break
		}
		ceiling = batch[len(batch)-1].Id - 1
		if userID > 0 {
			formatUserLogs(batch, count)
		}
		for _, entry := range batch {
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := write(entry); err != nil {
				return err
			}
			count++
		}
	}
	return nil
}
