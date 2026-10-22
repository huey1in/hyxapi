package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/log_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

type logFeedItem struct {
	Key        string            `json:"key"`
	Source     string            `json:"source"`
	Time       int64             `json:"time"`
	Log        *model.Log        `json:"log,omitempty"`
	Task       *dto.TaskDto      `json:"task,omitempty"`
	Midjourney *model.Midjourney `json:"midjourney,omitempty"`
}

func feedFilter(c *gin.Context, all bool) (model.LogFeedFilter, int, int, bool) {
	f := model.LogFeedFilter{Source: c.Query("source"), TaskID: c.Query("task_id"), Platform: c.Query("platform"), Status: c.Query("status"), Action: c.Query("action")}
	userID, role := c.GetInt("id"), c.GetInt("role")
	if userID <= 0 || (all && role < common.RoleAdminUser) {
		c.AbortWithStatus(http.StatusForbidden)
		return f, 0, 0, false
	}
	validSource := func(value string) bool {
		for _, source := range model.LogFeedSources {
			if source == value {
				return true
			}
		}
		return false
	}
	if f.Source != "" && !validSource(f.Source) {
		common.ApiErrorMsg(c, "invalid log source")
		return f, 0, 0, false
	}
	if values, present := c.GetQuery("sources"); present {
		f.Sources = []string{}
		seen := map[string]bool{}
		for _, value := range strings.Split(values, ",") {
			if !validSource(value) || seen[value] {
				common.ApiErrorMsg(c, "invalid log sources")
				return f, 0, 0, false
			}
			f.Sources, seen[value] = append(f.Sources, value), true
		}
	}
	for _, field := range []struct {
		name  string
		value *int64
	}{{"start_timestamp", &f.StartTimestamp}, {"end_timestamp", &f.EndTimestamp}} {
		value, err := strconv.ParseInt(c.DefaultQuery(field.name, "0"), 10, 64)
		if err != nil || value < 0 || value > 8640000000000 {
			common.ApiErrorMsg(c, "invalid time range")
			return f, 0, 0, false
		}
		*field.value = value
	}
	start, end := f.StartTimestamp, f.EndTimestamp
	if !applyLogRange(c, &start, &end) {
		return f, 0, 0, false
	}
	var err error
	f.Type, err = strconv.Atoi(c.DefaultQuery("type", "0"))
	if err != nil || f.Type < 0 || f.Type > 7 {
		common.ApiErrorMsg(c, "invalid log type")
		return f, 0, 0, false
	}
	f.ModelName, f.TokenName, f.Group, f.RequestId = c.Query("model_name"), c.Query("token_name"), c.Query("group"), c.Query("request_id")
	if all {
		f.Username = c.Query("username")
		userID = 0
	} else {
		role = common.RoleCommonUser
	}
	if role >= common.RoleRootUser {
		f.UpstreamRequestId = c.Query("upstream_request_id")
	}
	return f, userID, role, true
}

func projectLogFeed(entries []model.LogFeedEntry, role int) []logFeedItem {
	logs, tasks := []*model.Log{}, []*model.Task{}
	for _, entry := range entries {
		if entry.Log != nil {
			logs = append(logs, entry.Log)
		}
		if entry.Task != nil {
			tasks = append(tasks, entry.Task)
		}
	}
	model.ProjectLogsForRole(logs, role)
	taskViews := tasksToDto(tasks, role >= common.RoleAdminUser, role)
	items := make([]logFeedItem, 0, len(entries))
	taskIndex := 0
	for _, entry := range entries {
		item := logFeedItem{Key: entry.Key, Source: entry.Source, Time: entry.Time, Log: entry.Log, Midjourney: entry.Midjourney}
		if entry.Task != nil {
			item.Task = taskViews[taskIndex]
			taskIndex++
		}
		if item.Midjourney != nil && setting.MjForwardUrlEnabled {
			item.Midjourney.ImageUrl = system_setting.ServerAddress + "/mj/image/" + item.Midjourney.MjId
		}
		items = append(items, item)
	}
	return items
}

func GetLogFeed(c *gin.Context)     { getLogFeed(c, true) }
func GetUserLogFeed(c *gin.Context) { getLogFeed(c, false) }

func getLogFeed(c *gin.Context, all bool) {
	f, userID, role, ok := feedFilter(c, all)
	if !ok {
		return
	}
	size, err := strconv.Atoi(c.DefaultQuery("size", "20"))
	if err != nil || size < 1 || size > 100 || len(c.Query("cursor")) > 4096 {
		common.ApiErrorMsg(c, "invalid log pagination")
		return
	}
	page, err := model.GetLogFeed(c.Request.Context(), f, userID, c.Query("cursor"), size)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": projectLogFeed(page.Items, role), "total": page.Total, "next_cursor": page.NextCursor})
}

func ExportLogFeed(c *gin.Context)     { exportLogFeed(c, true) }
func ExportUserLogFeed(c *gin.Context) { exportLogFeed(c, false) }

func exportLogFeed(c *gin.Context, all bool) {
	f, userID, role, ok := feedFilter(c, all)
	if !ok {
		return
	}
	if !all && c.GetInt("role") < common.RoleAdminUser && !log_setting.GetSetting().UserExportEnabled {
		common.ApiErrorMsg(c, "Log export is disabled")
		return
	}
	ctx, release, ok, err := service.AcquireLogExportLock(c.Request.Context(), c.GetInt("id"))
	if err != nil {
		common.ApiErrorMsg(c, "Failed to start log export")
		return
	}
	if !ok {
		common.ApiErrorMsg(c, "Another log export is running")
		return
	}
	defer release()
	c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
	c.Header("Cache-Control", "no-store")
	c.Header("X-Accel-Buffering", "no")
	count := 0
	err = model.StreamLogFeed(ctx, f, userID, func(entries []model.LogFeedEntry) error {
		for _, entry := range projectLogFeed(entries, role) {
			if err := ctx.Err(); err != nil {
				return err
			}
			data, err := common.Marshal(entry)
			if err != nil {
				return err
			}
			if _, err = c.Writer.Write(append(data, '\n')); err != nil {
				return err
			}
			count++
		}
		return nil
	})
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		common.ApiErrorMsg(c, "Failed to export logs")
		return
	}
	common.ApiSuccess(c, gin.H{"count": count})
}
