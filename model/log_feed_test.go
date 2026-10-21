package model

import (
	"context"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupFeedTest(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Midjourney{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM midjourneys") })
}

func TestLogFeedMergesChronologicallyWithoutDroppingTiesAndFreezesNewIDs(t *testing.T) {
	setupFeedTest(t)
	for i := range 31 {
		require.NoError(t, LOG_DB.Create(&Log{UserId: 71, CreatedAt: 100 + int64(i/3), Content: fmt.Sprint(i)}).Error)
		require.NoError(t, DB.Create(&Task{UserId: 71, TaskID: fmt.Sprint(i), SubmitTime: 100 + int64(i/3), Status: TaskStatusSuccess}).Error)
		require.NoError(t, DB.Create(&Midjourney{UserId: 71, MjId: fmt.Sprint(i), SubmitTime: 100000 + int64(i/3)*1000 + 500}).Error)
	}
	filter := LogFeedFilter{}
	page, err := GetLogFeed(context.Background(), filter, 71, "", 20)
	require.NoError(t, err)
	require.EqualValues(t, 93, page.Total)
	require.Len(t, page.Items, 20)
	require.NotEmpty(t, page.NextCursor)
	require.NoError(t, LOG_DB.Create(&Log{UserId: 71, CreatedAt: 100, Content: "late"}).Error)
	require.NoError(t, DB.Create(&Task{UserId: 71, TaskID: "late", SubmitTime: 100}).Error)
	require.NoError(t, DB.Create(&Midjourney{UserId: 71, MjId: "late", SubmitTime: 100000}).Error)
	seen := map[string]bool{}
	previous := int64(1<<63 - 1)
	for {
		for _, row := range page.Items {
			require.LessOrEqual(t, row.Time, previous)
			previous = row.Time
			require.False(t, seen[row.Key], row.Key)
			seen[row.Key] = true
			if row.Log != nil {
				require.NotEqual(t, "late", row.Log.Content)
			}
			if row.Task != nil {
				require.NotEqual(t, "late", row.Task.TaskID)
			}
			if row.Midjourney != nil {
				require.NotEqual(t, "late", row.Midjourney.MjId)
			}
		}
		if page.NextCursor == "" {
			break
		}
		page, err = GetLogFeed(context.Background(), filter, 71, page.NextCursor, 20)
		require.NoError(t, err)
		require.EqualValues(t, 93, page.Total)
	}
	require.Len(t, seen, 93)
}

func TestLogFeedScopesFiltersAndCursorValidation(t *testing.T) {
	setupFeedTest(t)
	for _, id := range []int{71, 72} {
		require.NoError(t, DB.Create(&User{Id: id, Username: fmt.Sprintf("feed-user-%d", id), AffCode: fmt.Sprint(id)}).Error)
		require.NoError(t, LOG_DB.Create(&Log{UserId: id, Username: fmt.Sprintf("feed-user-%d", id), CreatedAt: 100, ModelName: "model", ChannelId: 5, Type: LogTypeConsume}).Error)
		require.NoError(t, DB.Create(&Task{UserId: id, TaskID: "task", SubmitTime: 100, Status: TaskStatusSuccess, ChannelId: 5, Platform: "suno"}).Error)
		require.NoError(t, DB.Create(&Midjourney{UserId: id, MjId: "mj", SubmitTime: 100999, Status: "FAILURE", ChannelId: 5}).Error)
	}
	for _, test := range []struct {
		filter LogFeedFilter
		userID int
		total  int64
	}{
		{LogFeedFilter{}, 71, 3}, {LogFeedFilter{}, 0, 6},
		{LogFeedFilter{LogFilter: LogFilter{Username: "feed-user-71"}}, 0, 3},
		{LogFeedFilter{LogFilter: LogFilter{StartTimestamp: 100, EndTimestamp: 100}}, 71, 3},
		{LogFeedFilter{LogFilter: LogFilter{ModelName: "model"}}, 71, 1},
		{LogFeedFilter{LogFilter: LogFilter{Channel: 6}}, 0, 0},
		{LogFeedFilter{Sources: []string{"tasks"}}, 71, 1},
		{LogFeedFilter{Source: "midjourney", Status: "FAILURE"}, 71, 1},
		{LogFeedFilter{Platform: "suno", Status: "SUCCESS"}, 71, 1},
	} {
		page, err := GetLogFeed(context.Background(), test.filter, test.userID, "", 20)
		require.NoError(t, err)
		require.Equal(t, test.total, page.Total, test.filter)
		require.Len(t, page.Items, int(test.total))
	}
	page, err := GetLogFeed(context.Background(), LogFeedFilter{}, 71, "", 1)
	require.NoError(t, err)
	_, err = GetLogFeed(context.Background(), LogFeedFilter{}, 72, page.NextCursor, 1)
	require.Error(t, err)
	_, err = GetLogFeed(context.Background(), LogFeedFilter{Source: "usage"}, 71, page.NextCursor, 1)
	require.Error(t, err)
	_, err = GetLogFeed(context.Background(), LogFeedFilter{}, 71, "broken", 1)
	require.Error(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.Error(t, StreamLogFeed(ctx, LogFeedFilter{}, 71, func([]LogFeedEntry) error { t.Fatal("canceled export wrote rows"); return nil }))
}

func TestLogFeedWithSeparateIDLessLogStorageAndStreamingExport(t *testing.T) {
	setupFeedTest(t)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))
	require.NoError(t, db.Exec("CREATE TABLE copy_logs AS SELECT * FROM logs WHERE 1 = 0").Error)
	require.NoError(t, db.Migrator().DropTable(&Log{}))
	require.NoError(t, db.Migrator().RenameTable("copy_logs", "logs"))
	previous, previousType := LOG_DB, common.LogDatabaseType()
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)
	t.Cleanup(func() {
		LOG_DB = previous
		common.SetLogDatabaseType(previousType)
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	for i := range 503 {
		require.NoError(t, db.Exec("INSERT INTO logs (id,user_id,created_at,type,request_id,content) VALUES(0,71,100,2,'repeated',?)", fmt.Sprint(i)).Error)
	}
	seen := map[string]bool{}
	require.NoError(t, StreamLogFeed(context.Background(), LogFeedFilter{}, 71, func(rows []LogFeedEntry) error {
		for _, row := range rows {
			require.False(t, seen[row.Log.Content])
			seen[row.Log.Content] = true
		}
		return nil
	}))
	require.Len(t, seen, 503)
	// The user-name subquery uses the main database's escaping even when the
	// independent log store uses ClickHouse's LIKE rules.
	require.NoError(t, DB.Create(&User{Id: 71, Username: "feed_user_71", AffCode: "feed-71"}).Error)
	require.NoError(t, DB.Create(&Task{UserId: 71, TaskID: "task", SubmitTime: 100}).Error)
	page, err := GetLogFeed(context.Background(), LogFeedFilter{Source: "tasks", LogFilter: LogFilter{Username: "feed_user%"}}, 0, "", 20)
	require.NoError(t, err)
	require.EqualValues(t, 1, page.Total)
}

func TestLogFeedMySQLMergesScopesAndTimestampUnits(t *testing.T) {
	db := openIsolatedMySQLMigrationDB(t)
	require.NoError(t, db.AutoMigrate(&Log{}, &Task{}, &Midjourney{}, &User{}))
	previous, previousLog := DB, LOG_DB
	mainType, logType, groupColumn := common.MainDatabaseType(), common.LogDatabaseType(), logGroupCol
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeMySQL, common.DatabaseTypeMySQL)
	logGroupCol = "`group`"
	t.Cleanup(func() {
		DB, LOG_DB, logGroupCol = previous, previousLog, groupColumn
		common.SetDatabaseTypes(mainType, logType)
	})
	for _, id := range []int{71, 72} {
		require.NoError(t, db.Create(&User{Id: id, Username: fmt.Sprintf("feed_user_%d", id), AffCode: fmt.Sprint(id)}).Error)
		require.NoError(t, db.Create(&Log{UserId: id, Username: fmt.Sprintf("feed_user_%d", id), CreatedAt: 100, Type: LogTypeConsume}).Error)
		require.NoError(t, db.Create(&Task{UserId: id, TaskID: "task", CreatedAt: 100}).Error)
		require.NoError(t, db.Create(&Midjourney{UserId: id, MjId: "mj", SubmitTime: 100999}).Error)
	}
	filter := LogFeedFilter{LogFilter: LogFilter{Username: "feed_user_7%", StartTimestamp: 100, EndTimestamp: 100}}
	page, err := GetLogFeed(context.Background(), filter, 0, "", 2)
	require.NoError(t, err)
	require.EqualValues(t, 6, page.Total)
	require.Len(t, page.Items, 2)
	require.Equal(t, "midjourney", page.Items[0].Source)
	page, err = GetLogFeed(context.Background(), filter, 0, page.NextCursor, 2)
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	page, err = GetLogFeed(context.Background(), LogFeedFilter{}, 71, "", 20)
	require.NoError(t, err)
	require.EqualValues(t, 3, page.Total)
}
