package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/log_setting"
	"github.com/gin-gonic/gin"
)

func limitLogTimeRange(start, end int64) (int64, error) {
	if start < 0 || end < 0 || (end > 0 && start > end) {
		return 0, fmt.Errorf("invalid time range")
	}
	end = min(time.Now().Unix(), endOrNow(end))
	if start > end {
		return 0, fmt.Errorf("invalid time range")
	}
	seconds := log_setting.GetSetting().MaxRangeSeconds()
	if start == 0 {
		return end - seconds, nil
	}
	if end-start > seconds {
		return 0, fmt.Errorf("时间跨度不能超过 %d 天 / time range cannot exceed %d days", seconds/86400, seconds/86400)
	}
	return start, nil
}

func endOrNow(end int64) int64 {
	if end == 0 {
		return time.Now().Unix()
	}
	return min(end, time.Now().Unix())
}

func applyLogRange(c *gin.Context, start, end *int64, export bool) bool {
	if !export && c.GetInt("role") >= common.RoleAdminUser {
		return true
	}
	value, err := limitLogTimeRange(*start, *end)
	if err != nil {
		common.ApiError(c, err)
		return false
	}
	*start = value
	*end = endOrNow(*end)
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
	if !applyLogRange(c, &start, &end, true) {
		return
	}
	filter := model.LogFilter{StartTimestamp: start, EndTimestamp: endOrNow(end), ModelName: c.Query("model_name"), TokenName: c.Query("token_name"), Group: c.Query("group"), RequestId: c.Query("request_id")}
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
		filter.Channel, _ = strconv.Atoi(c.Query("channel"))
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
