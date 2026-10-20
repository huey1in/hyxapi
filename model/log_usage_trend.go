package model

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	_ "time/tzdata"
)

type LogUsagePoint struct {
	Timestamp int64 `json:"timestamp"`
	Quota     int64 `json:"quota"`
}

type LogUsageTrend struct {
	Interval string          `json:"interval"`
	Points   []LogUsagePoint `json:"points"`
}

// Calendar boundaries follow the browser's timezone, including DST changes.
// Longer custom ranges use months or years to keep the query and chart bounded.
func logUsageBuckets(start, end int64, location *time.Location) (LogUsageTrend, error) {
	trend := LogUsageTrend{Interval: "day", Points: make([]LogUsagePoint, 0)}
	if start < 0 || end < start || end > 253402300799 || location == nil {
		return trend, errors.New("invalid time range")
	}
	first, last := time.Unix(start, 0).In(location), time.Unix(end, 0).In(location)
	cursor := time.Date(first.Year(), first.Month(), first.Day(), 0, 0, 0, 0, location)
	next := func(value time.Time) time.Time { return value.AddDate(0, 0, 1) }
	if end-start < 2*86400 {
		trend.Interval = "hour"
		// Subtract elapsed minutes rather than reconstructing an ambiguous hour
		// during the autumn DST transition.
		cursor = first.Add(-time.Duration(first.Minute())*time.Minute - time.Duration(first.Second())*time.Second)
		next = func(value time.Time) time.Time { return value.Add(time.Hour) }
	} else if end-start > 120*86400 {
		trend.Interval = "month"
		cursor = time.Date(first.Year(), first.Month(), 1, 0, 0, 0, 0, location)
		next = func(value time.Time) time.Time { return value.AddDate(0, 1, 0) }
		if last.Year()*12+int(last.Month())-(first.Year()*12+int(first.Month())) >= 120 {
			trend.Interval = "year"
			cursor = time.Date(first.Year(), 1, 1, 0, 0, 0, 0, location)
			next = func(value time.Time) time.Time { return value.AddDate(1, 0, 0) }
		}
	}
	for cursor.Unix() <= end {
		if len(trend.Points) >= 128 {
			return trend, errors.New("time range is too large")
		}
		trend.Points = append(trend.Points, LogUsagePoint{Timestamp: cursor.Unix()})
		following := next(cursor)
		if !following.After(cursor) {
			return trend, errors.New("invalid time range")
		}
		cursor = following
	}
	return trend, nil
}

// SumLogUsageWithTrend derives both totals and the series from one aggregation,
// using exactly the same actor, key and inclusive time filters as SumLogUsage.
func SumLogUsageWithTrend(ctx context.Context, filter LogFilter, userID int, timezone string) (Stat, *LogUsageTrend, error) {
	if userID < 0 || filter.TokenID < 0 || timezone == "Local" {
		return Stat{}, nil, errors.New("invalid usage filter")
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return Stat{}, nil, errors.New("invalid timezone")
	}
	trend, err := logUsageBuckets(filter.StartTimestamp, filter.EndTimestamp, location)
	if err != nil {
		return Stat{}, nil, err
	}
	filter.Type = LogTypeConsume
	query, err := buildLogQuery(filter, userID)
	if err != nil {
		return Stat{}, nil, err
	}
	var expression strings.Builder
	if len(trend.Points) == 1 {
		expression.WriteString("0")
	} else {
		expression.WriteString("CASE")
		for index := 1; index < len(trend.Points); index++ {
			// Only server-generated integer boundaries enter this SQL expression.
			fmt.Fprintf(&expression, " WHEN logs.created_at < %d THEN %d", trend.Points[index].Timestamp, index-1)
		}
		fmt.Fprintf(&expression, " ELSE %d END", len(trend.Points)-1)
	}
	var rows []struct {
		Bucket int
		Stat
	}
	err = query.WithContext(ctx).
		Select(expression.String() + " AS bucket, COALESCE(SUM(quota), 0) AS quota, COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS tokens, COUNT(*) AS requests").
		Group("bucket").Scan(&rows).Error
	if err != nil {
		return Stat{}, nil, err
	}
	var stat Stat
	for _, row := range rows {
		if row.Bucket < 0 || row.Bucket >= len(trend.Points) {
			return Stat{}, nil, errors.New("invalid usage bucket")
		}
		trend.Points[row.Bucket].Quota = int64(row.Quota)
		stat.Quota += row.Quota
		stat.Tokens += row.Tokens
		stat.Requests += row.Requests
	}
	return stat, &trend, nil
}
