package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/log_setting"
	"github.com/gin-gonic/gin"
)

func endOrNow(end int64) int64 {
	if end == 0 {
		return time.Now().Unix()
	}
	return min(end, time.Now().Unix())
}

func applyLogRange(c *gin.Context, start, end *int64) bool {
	normalizedEnd := endOrNow(*end)
	if *start < 0 || *end < 0 || *start > normalizedEnd {
		common.ApiErrorMsg(c, "invalid time range")
		return false
	}
	*end = normalizedEnd
	return true
}

func ExportAllLogs(c *gin.Context)  { exportLogs(c, true) }
func ExportUserLogs(c *gin.Context) { exportLogs(c, false) }

// The final NDJSON record confirms completion before the browser saves CSV.
func exportLogs(c *gin.Context, all bool) {
	if !all && c.GetInt("role") < common.RoleAdminUser && !log_setting.GetSetting().UserExportEnabled {
		common.ApiErrorMsg(c, "Log export is disabled")
		return
	}
	start, err := strconv.ParseInt(c.DefaultQuery("start_timestamp", "0"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid start_timestamp")
		return
	}
	end, err := strconv.ParseInt(c.DefaultQuery("end_timestamp", "0"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid end_timestamp")
		return
	}
	if !applyLogRange(c, &start, &end) {
		return
	}
	filter := model.LogFilter{StartTimestamp: start, EndTimestamp: endOrNow(end), ModelName: c.Query("model_name"), TokenName: c.Query("token_name"), Group: c.Query("group"), RequestId: c.Query("request_id")}
	if c.GetInt("role") >= common.RoleRootUser {
		filter.UpstreamRequestId = c.Query("upstream_request_id")
	}
	filter.Type, _ = strconv.Atoi(c.Query("type"))
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	queryUserID := userID
	if all {
		queryUserID = 0
		filter.Username = c.Query("username")
	}
	exportCtx, release, ok, err := service.AcquireLogExportLock(c.Request.Context(), userID)
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
	err = model.StreamLogs(exportCtx, filter, queryUserID, func(entry *model.Log) error {
		model.ProjectLogsForRole([]*model.Log{entry}, c.GetInt("role"))
		data, err := common.Marshal(entry)
		if err != nil {
			return err
		}
		_, err = c.Writer.Write(append(data, '\n'))
		count++
		return err
	})
	if exportCtx.Err() != nil {
		return
	}
	if err != nil {
		common.ApiErrorMsg(c, "Failed to export logs")
		return
	}
	common.ApiSuccess(c, gin.H{"count": count})
}
