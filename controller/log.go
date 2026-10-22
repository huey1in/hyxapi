package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := ""
	if c.GetInt("role") >= common.RoleRootUser {
		upstreamRequestId = c.Query("upstream_request_id")
	}
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	model.ProjectLogsForRole(logs, c.GetInt("role"))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUserLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if !applyLogRange(c, &startTimestamp, &endTimestamp) {
		return
	}
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetLogByKey(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "无效的令牌",
		})
		return
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
}

func GetLogsStat(c *gin.Context) {
	getLogUsage(c, true)
}

func GetLogsSelfStat(c *gin.Context) {
	getLogUsage(c, false)
}

func GetLogTokenOptions(c *gin.Context) {
	getLogTokenOptions(c, true)
}

func GetUserLogTokenOptions(c *gin.Context) {
	getLogTokenOptions(c, false)
}

// Key choices and totals share validation and the immutable actor scope.
func logUsageFilter(c *gin.Context, all bool) (model.LogFilter, int, bool) {
	filter := model.LogFilter{ModelName: c.Query("model_name"), TokenName: c.Query("token_name"), Group: c.Query("group")}
	var err error
	filter.StartTimestamp, err = strconv.ParseInt(c.DefaultQuery("start_timestamp", "0"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid start_timestamp")
		return filter, 0, false
	}
	filter.EndTimestamp, err = strconv.ParseInt(c.DefaultQuery("end_timestamp", "0"), 10, 64)
	if err != nil || filter.StartTimestamp < 0 || filter.EndTimestamp < 0 || (filter.EndTimestamp > 0 && filter.StartTimestamp > filter.EndTimestamp) || filter.StartTimestamp > time.Now().Unix() {
		common.ApiErrorMsg(c, "invalid time range")
		return filter, 0, false
	}
	filter.EndTimestamp = endOrNow(filter.EndTimestamp)
	filter.TokenID, err = strconv.Atoi(c.DefaultQuery("token_id", "0"))
	if err != nil || filter.TokenID < 0 || (c.Query("token_id") != "" && filter.TokenID == 0) {
		common.ApiErrorMsg(c, "invalid token_id")
		return filter, 0, false
	}
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return filter, 0, false
	}
	if all {
		filter.Username = c.Query("username")
		userID = 0
	}
	return filter, userID, true
}

func getLogUsage(c *gin.Context, all bool) {
	filter, userID, ok := logUsageFilter(c, all)
	if !ok {
		return
	}
	includeTrend, err := strconv.ParseBool(c.DefaultQuery("include_trend", "false"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid include_trend")
		return
	}
	var result struct {
		model.Stat
		Trend *model.LogUsageTrend `json:"trend,omitempty"`
	}
	if includeTrend {
		result.Stat, result.Trend, err = model.SumLogUsageWithTrend(c.Request.Context(), filter, userID, c.DefaultQuery("timezone", "UTC"))
	} else {
		result.Stat, err = model.SumLogUsage(c.Request.Context(), filter, userID)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func getLogTokenOptions(c *gin.Context, all bool) {
	filter, userID, ok := logUsageFilter(c, all)
	if !ok {
		return
	}
	options, err := model.GetLogTokenOptions(c.Request.Context(), filter, userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, options)
}

func DeleteHistoryLogs(c *gin.Context) {
	targetTimestamp, _ := strconv.ParseInt(c.Query("target_timestamp"), 10, 64)
	if targetTimestamp == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "target timestamp is required",
		})
		return
	}
	count, err := model.DeleteOldLog(c.Request.Context(), targetTimestamp, 100)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
	return
}
