package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func getDailyTokenUsage(c *gin.Context, userID int) {
	endTimestamp := time.Now().Unix()
	startTimestamp := time.Now().AddDate(-1, 0, 0).Unix()
	if value, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64); err == nil && value > 0 {
		startTimestamp = value
	}
	if value, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64); err == nil && value > 0 {
		endTimestamp = value
	}
	bucketSeconds, _ := strconv.ParseInt(c.Query("bucket_seconds"), 10, 64)
	if bucketSeconds < 1 || bucketSeconds > 86400*31 {
		bucketSeconds = 86400
	}
	data, err := loadTokenUsageData(c.Request.Context(), userID, startTimestamp, endTimestamp, bucketSeconds)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, data)
}

func loadTokenUsageData(parent context.Context, userID int, startTimestamp, endTimestamp, bucketSeconds int64) ([]model.DailyConsumption, error) {
	cacheKey := fmt.Sprintf("log:token-usage:v1:%d:%d:%d:%d", userID, startTimestamp, endTimestamp/15, bucketSeconds)
	if common.RedisEnabled && common.RDB != nil {
		if cached, err := common.RedisGet(cacheKey); err == nil {
			var data []model.DailyConsumption
			if json.Unmarshal([]byte(cached), &data) == nil {
				return data, nil
			}
		}
	}

	queryCtx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()
	data, err := model.GetTokenUsageByBucket(queryCtx, userID, startTimestamp, endTimestamp, bucketSeconds)
	if err != nil {
		return nil, err
	}
	if common.RedisEnabled && common.RDB != nil {
		if encoded, err := json.Marshal(data); err == nil {
			_ = common.RedisSet(cacheKey, string(encoded), 15*time.Second)
		}
	}
	return data, nil
}

func GetTokenUsageByDay(c *gin.Context) {
	getDailyTokenUsage(c, 0)
}

func GetSelfTokenUsageByDay(c *gin.Context) {
	getDailyTokenUsage(c, c.GetInt("id"))
}

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
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
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":    stat.Quota,
			"tokens":   stat.Tokens,
			"requests": stat.Requests,
		},
	}
	bucketSeconds, _ := strconv.ParseInt(c.Query("bucket_seconds"), 10, 64)
	if bucketSeconds < 1 && startTimestamp > 0 {
		usageEnd := endTimestamp
		if usageEnd == 0 {
			usageEnd = time.Now().Unix()
		}
		bucketSeconds = (usageEnd - startTimestamp + 363) / 364
	}
	if bucketSeconds > 0 {
		usageEnd := endTimestamp
		if usageEnd == 0 {
			usageEnd = time.Now().Unix()
		}
		usage, usageErr := loadTokenUsageData(c.Request.Context(), 0, startTimestamp, usageEnd, bucketSeconds)
		if usageErr == nil {
			response["data"].(gin.H)["token_usage"] = usage
		}
	}
	c.JSON(http.StatusOK, response)
	return
}

func GetLogsSelfStat(c *gin.Context) {
	username := c.GetString("username")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":    quotaNum.Quota,
			"tokens":   quotaNum.Tokens,
			"requests": quotaNum.Requests,
		},
	}
	bucketSeconds, _ := strconv.ParseInt(c.Query("bucket_seconds"), 10, 64)
	if bucketSeconds < 1 && startTimestamp > 0 {
		usageEnd := endTimestamp
		if usageEnd == 0 {
			usageEnd = time.Now().Unix()
		}
		bucketSeconds = (usageEnd - startTimestamp + 363) / 364
	}
	if bucketSeconds > 0 {
		usageEnd := endTimestamp
		if usageEnd == 0 {
			usageEnd = time.Now().Unix()
		}
		usage, usageErr := loadTokenUsageData(c.Request.Context(), c.GetInt("id"), startTimestamp, usageEnd, bucketSeconds)
		if usageErr == nil {
			response["data"].(gin.H)["token_usage"] = usage
		}
	}
	c.JSON(200, response)
	return
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
