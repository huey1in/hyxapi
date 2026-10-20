package model

import (
	"context"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// LogFilter is shared by paginated searches and keyset exports.
type LogFilter struct {
	Type, Channel                                                       int
	StartTimestamp, EndTimestamp                                        int64
	ModelName, Username, TokenName, Group, RequestId, UpstreamRequestId string
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
		var err error
		q, err = applyExplicitLogTextFilter(q, "logs.model_name", f.ModelName)
		if err != nil {
			return nil, err
		}
	}
	if f.UpstreamRequestId != "" {
		q = q.Where("logs.upstream_request_id = ?", f.UpstreamRequestId)
	}
	if f.Username != "" {
		var err error
		q, err = applyExplicitLogTextFilter(q, "logs.username", f.Username)
		if err != nil {
			return nil, err
		}
	}
	for _, v := range []struct{ column, value string }{{"token_name", f.TokenName}, {"request_id", f.RequestId}} {
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
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		return streamClickHouseLogs(ctx, q, userID, write)
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

// MergeTree log IDs are not generated sequentially. One streaming query keeps
// duplicate request IDs and equal timestamps without inventing an ID cursor.
func streamClickHouseLogs(ctx context.Context, q *gorm.DB, userID int, write func(*Log) error) error {
	rows, err := q.WithContext(ctx).Order(clickHouseLogOrder("logs.")).Rows()
	if err != nil {
		return err
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return err
		}
		var entry Log
		if err := q.ScanRows(rows, &entry); err != nil {
			return err
		}
		entry.Id = count + 1
		if userID > 0 {
			formatUserLogs([]*Log{&entry}, count)
		}
		if err := write(&entry); err != nil {
			return err
		}
		count++
	}
	return rows.Err()
}
