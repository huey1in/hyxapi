package controller

import (
	"fmt"
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

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()

	allTimeRevenue, _ := model.GetTopUpRevenueSummary(0, 0)
	rangeRevenue, _ := model.GetTopUpRevenueSummary(startTimestamp, endTimestamp)
	todayRevenue, _ := model.GetTopUpRevenueSummary(todayStart, 0)

	todayConsumption, _ := model.SumUsedQuota(model.LogTypeConsume, todayStart, 0, "", "", "", 0, "")
	allTimeConsumption, _ := model.SumUsedQuota(model.LogTypeConsume, 0, 0, "", "", "", 0, "")

	revenueTrend, _ := model.GetTopUpRevenueByDay(startTimestamp, endTimestamp)
	consumptionTrend, consumptionErr := model.GetConsumptionByDay(startTimestamp, endTimestamp)
	if consumptionErr != nil {
		common.SysError(fmt.Sprintf("GetConsumptionByDay failed: start=%d, end=%d, err=%v", startTimestamp, endTimestamp, consumptionErr))
	}

	userRanking, _ := model.GetTopConsumingUsers(startTimestamp, endTimestamp, 20)
	modelRanking, _ := model.GetModelConsumption(startTimestamp, endTimestamp, 20)
	channelRanking, _ := model.GetChannelConsumption(startTimestamp, endTimestamp, 15)
	groupRanking, _ := model.GetGroupConsumption(startTimestamp, endTimestamp, 15)

	errorStats, _ := model.GetErrorStats(startTimestamp, endTimestamp)
	todayErrors, _ := model.GetErrorStats(todayStart, 0)
	topErrorModels, _ := model.GetTopErrorModels(startTimestamp, endTimestamp, 10)

	var totalUsers int64
	model.DB.Model(&model.User{}).Count(&totalUsers)
	var enabledChannels int64
	model.DB.Model(&model.Channel{}).Where("status = ?", common.ChannelStatusEnabled).Count(&enabledChannels)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"summary": gin.H{
				"revenue": gin.H{
					"all_time": allTimeRevenue,
					"range":    rangeRevenue,
					"today":    todayRevenue,
				},
				"consumption": gin.H{
					"today":    todayConsumption,
					"all_time": allTimeConsumption,
				},
			},
			"trend": gin.H{
				"revenue":     revenueTrend,
				"consumption": consumptionTrend,
			},
			"rankings": gin.H{
				"users":    userRanking,
				"models":   modelRanking,
				"channels": channelRanking,
				"groups":   groupRanking,
			},
			"errors": gin.H{
				"range":      errorStats,
				"today":      todayErrors,
				"top_models": topErrorModels,
			},
			"channel_efficiency": []any{},
			"platform": gin.H{
				"total_users":      totalUsers,
				"enabled_channels": enabledChannels,
			},
		},
	})
}
