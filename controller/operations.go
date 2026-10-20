package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetRevenueSummary(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()

	allTime, err := model.GetTopUpRevenueSummary(0, 0)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	rangeSummary, err := model.GetTopUpRevenueSummary(startTimestamp, endTimestamp)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	today, err := model.GetTopUpRevenueSummary(todayStart, 0)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"all_time": allTime,
			"range":    rangeSummary,
			"today":    today,
		},
	})
}

func GetRevenueTrend(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	data, err := model.GetTopUpRevenueByDay(startTimestamp, endTimestamp)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
}

func GetConsumptionTrend(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	data, err := model.GetConsumptionByDay(startTimestamp, endTimestamp)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
}

func GetConsumptionRanking(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	rankType := c.DefaultQuery("type", "user")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	switch rankType {
	case "model":
		data, err := model.GetModelConsumption(startTimestamp, endTimestamp, limit)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
	default:
		data, err := model.GetTopConsumingUsers(startTimestamp, endTimestamp, limit)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
	}
}

func GetEnhancedOperations(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	fail := func(err error) bool {
		if err == nil {
			return false
		}
		common.SysError("failed to query operations report: " + err.Error())
		common.ApiErrorMsg(c, "Unable to load operations data")
		return true
	}
	rangeRevenue, err := model.GetTopUpRevenueSummary(startTimestamp, endTimestamp)
	if fail(err) {
		return
	}
	rangeConsumption, err := model.SumUsedQuota(model.LogTypeConsume, startTimestamp, endTimestamp, "", "", "", 0, "")
	if fail(err) {
		return
	}
	activeStat, err := model.GetActiveOperationsStat(startTimestamp, endTimestamp)
	if fail(err) {
		return
	}
	newUsers, err := model.CountNewUsers(startTimestamp, endTimestamp)
	if fail(err) {
		return
	}
	channelCharges, err := model.GetChannelConsumption(startTimestamp, endTimestamp, 50)
	if fail(err) {
		return
	}
	groupCharges, err := model.GetGroupConsumption(startTimestamp, endTimestamp, 50)
	if fail(err) {
		return
	}
	averageRPM := 0.0
	if startTimestamp != 0 && endTimestamp > startTimestamp {
		minutes := float64(endTimestamp-startTimestamp) / 60
		if minutes < 1 {
			minutes = 1
		}
		averageRPM = float64(rangeConsumption.Requests) / minutes
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"period": gin.H{
				"start_timestamp": startTimestamp,
				"end_timestamp":   endTimestamp,
			},
			"summary": gin.H{
				"revenue": gin.H{
					"range": rangeRevenue,
				},
				"consumption": gin.H{
					"range":       rangeConsumption,
					"average_rpm": averageRPM,
				},
				"active": gin.H{
					"users":     activeStat.Users,
					"models":    activeStat.Models,
					"channels":  activeStat.Channels,
					"new_users": newUsers,
				},
			},
			"charges": gin.H{
				"groups":   groupCharges,
				"channels": channelCharges,
			},
		},
	})
}
