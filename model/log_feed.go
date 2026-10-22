package model

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var LogFeedSources = []string{"usage", "tasks", "midjourney"}

type LogFeedFilter struct {
	LogFilter
	Sources                                  []string
	Source, TaskID, Platform, Status, Action string
}

type LogFeedEntry struct {
	Key        string
	Source     string
	Time       int64 // Milliseconds; Midjourney already stores milliseconds.
	Log        *Log
	Task       *Task
	Midjourney *Midjourney
}

type LogFeedPage struct {
	Items      []LogFeedEntry
	Total      int64
	NextCursor string
}

type logFeedCursor struct {
	Fingerprint string   `json:"f"`
	At          int64    `json:"t"`
	Ceilings    [3]int64 `json:"c"`
	Offsets     [3]int   `json:"o"`
}

func feedSourceEnabled(f LogFeedFilter, source string) bool {
	if f.Source != "" && f.Source != source {
		return false
	}
	if f.Sources != nil {
		found := false
		for _, enabled := range f.Sources {
			found = found || enabled == source
		}
		if !found {
			return false
		}
	}
	if source != "usage" && (f.Type != 0 || f.ModelName != "" || f.TokenName != "" || f.Group != "" || f.RequestId != "" || f.UpstreamRequestId != "") {
		return false
	}
	if source == "usage" && (f.TaskID != "" || f.Platform != "" || f.Status != "" || f.Action != "") {
		return false
	}
	return source != "midjourney" || f.Platform == ""
}

func feedQuery(ctx context.Context, f LogFeedFilter, userID, index int, at int64) (*gorm.DB, string, error) {
	end := at
	if f.EndTimestamp > 0 && f.EndTimestamp < end {
		end = f.EndTimestamp
	}
	if index == 0 {
		f.EndTimestamp = end
		q, err := buildLogQuery(f.LogFilter, userID)
		order := "logs.created_at desc, logs.id desc"
		if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
			// Preserve distinct records even when the storage has no generated IDs.
			order = clickHouseLogOrder("logs.") + ", logs.id desc, logs.user_id desc, logs.type desc, logs.model_name desc, logs.token_name desc, logs.quota desc, logs.other desc, logs.content desc"
		}
		if err != nil {
			return nil, "", err
		}
		return q.WithContext(ctx), order, nil
	}
	table, idField, timeField, idColumn := "tasks", "task_id", "CASE WHEN submit_time > 0 THEN submit_time ELSE created_at END", "id"
	start := f.StartTimestamp
	if index == 2 {
		table, idField, timeField = "midjourneys", "mj_id", "submit_time"
		start, end = start*1000, end*1000+999
	}
	q := DB.WithContext(ctx).Table(table)
	if userID > 0 {
		q = q.Where("user_id = ?", userID)
	}
	if f.Username != "" {
		users := DB.Model(&User{}).Select("id")
		if strings.Contains(f.Username, "%") {
			pattern, err := sanitizeLikePattern(f.Username)
			if err != nil {
				return nil, "", err
			}
			users = users.Where("username LIKE ? ESCAPE '!'", pattern)
		} else {
			users = users.Where("username = ?", f.Username)
		}
		q = q.Where("user_id IN (?)", users)
	}
	for _, field := range []struct{ column, value string }{{idField, f.TaskID}, {"platform", f.Platform}, {"status", f.Status}, {"action", f.Action}} {
		if field.value != "" {
			q = q.Where(field.column+" = ?", field.value)
		}
	}
	q = q.Where(timeField+" >= ? AND "+timeField+" <= ?", start, end)
	return q, timeField + " desc, " + idColumn + " desc", nil
}

// Each source reads at most size+1 records. Independent offsets keep pagination
// bounded even when the log database is separate from the application database.
func GetLogFeed(ctx context.Context, f LogFeedFilter, userID int, cursor string, size int) (LogFeedPage, error) {
	return readLogFeed(ctx, f, userID, cursor, size, true)
}

func readLogFeed(ctx context.Context, f LogFeedFilter, userID int, cursor string, size int, count bool) (LogFeedPage, error) {
	page := LogFeedPage{Items: []LogFeedEntry{}}
	if size < 1 || size > 500 {
		return page, errors.New("invalid log page size")
	}
	fingerprint, _ := json.Marshal(struct {
		Filter LogFeedFilter
		UserID int
	}{f, userID})
	sum := sha256.Sum256(fingerprint)
	state := logFeedCursor{Fingerprint: fmt.Sprintf("%x", sum), At: time.Now().Unix()}
	initial := cursor == ""
	if !initial {
		raw, err := base64.RawURLEncoding.DecodeString(cursor)
		if err != nil || len(raw) > 2048 {
			return page, errors.New("invalid log cursor")
		}
		var decoded logFeedCursor
		if json.Unmarshal(raw, &decoded) != nil || decoded.Fingerprint != state.Fingerprint || decoded.At <= 0 || decoded.At > state.At {
			return page, errors.New("invalid log cursor")
		}
		state = decoded
	}
	entries := make([]LogFeedEntry, 0, 3*(size+1))
	for index, source := range LogFeedSources {
		if state.Offsets[index] < 0 || state.Offsets[index] > 2147483647 || state.Ceilings[index] < 0 {
			return page, errors.New("invalid log cursor")
		}
		if !feedSourceEnabled(f, source) {
			continue
		}
		q, order, err := feedQuery(ctx, f, userID, index, state.At)
		if err != nil {
			return page, err
		}
		if initial {
			if err = q.Session(&gorm.Session{}).Select("COALESCE(MAX(id), 0)").Scan(&state.Ceilings[index]).Error; err != nil {
				return page, err
			}
		}
		q = q.Where("id <= ?", state.Ceilings[index])
		if count {
			var total int64
			if err = q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
				return page, err
			}
			page.Total += total
		}
		q = q.Order(order).Offset(state.Offsets[index]).Limit(size + 1)
		appendEntry := func(offset int, entry LogFeedEntry) {
			entry.Key, entry.Source = fmt.Sprintf("%s:%d", source, state.Offsets[index]+offset), source
			entries = append(entries, entry)
		}
		switch index {
		case 0:
			var rows []*Log
			if err = q.Find(&rows).Error; err != nil {
				return page, err
			}
			for offset, row := range rows {
				appendEntry(offset, LogFeedEntry{Time: row.CreatedAt * 1000, Log: row})
			}
		case 1:
			var rows []*Task
			if err = q.Find(&rows).Error; err != nil {
				return page, err
			}
			for offset, row := range rows {
				at := row.SubmitTime
				if at == 0 {
					at = row.CreatedAt
				}
				appendEntry(offset, LogFeedEntry{Time: at * 1000, Task: row})
			}
		case 2:
			var rows []*Midjourney
			if err = q.Find(&rows).Error; err != nil {
				return page, err
			}
			for offset, row := range rows {
				appendEntry(offset, LogFeedEntry{Time: row.SubmitTime, Midjourney: row})
			}
		}
	}
	// Stable sorting retains each database's tie order; source order breaks ties
	// across tables, so identical integer IDs never collide in the UI.
	sort.SliceStable(entries, func(i, j int) bool { return entries[i].Time > entries[j].Time })
	hasMore := len(entries) > size
	if hasMore {
		entries = entries[:size]
	}
	for _, entry := range entries {
		for index, source := range LogFeedSources {
			if entry.Source == source {
				state.Offsets[index]++
			}
		}
	}
	page.Items = entries
	if hasMore {
		raw, err := json.Marshal(state)
		if err != nil {
			return page, err
		}
		page.NextCursor = base64.RawURLEncoding.EncodeToString(raw)
	}
	return page, nil
}

func StreamLogFeed(ctx context.Context, f LogFeedFilter, userID int, write func([]LogFeedEntry) error) error {
	cursor := ""
	for {
		page, err := readLogFeed(ctx, f, userID, cursor, 500, false)
		if err != nil {
			return err
		}
		if err = ctx.Err(); err != nil {
			return err
		}
		if err = write(page.Items); err != nil {
			return err
		}
		if page.NextCursor == "" {
			return nil
		}
		cursor = page.NextCursor
	}
}
