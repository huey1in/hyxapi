package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetLeaderboard(c *gin.Context) {
	userID := c.GetInt("id")
	if userID <= 0 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	period, metric := c.DefaultQuery("period", "today"), c.DefaultQuery("metric", "tokens")
	valid := (period == "today" || period == "week" || period == "month") && (metric == "tokens" || metric == "requests")
	for name, values := range c.Request.URL.Query() {
		valid = valid && (name == "period" || name == "metric") && len(values) == 1
	}
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid leaderboard filters"})
		return
	}
	user, err := model.GetUserCache(userID)
	if err != nil {
		common.ApiErrorMsg(c, "Unable to load leaderboard")
		return
	}
	// Reuse pricing visibility, so private model names cannot escape through
	// usage rankings even if they were present in the underlying logs.
	publicModels := make(map[string]bool)
	for _, item := range filterPublicPricing(model.GetPricing(), service.GetUserUsableGroups(user.Group)) {
		publicModels[item.ModelName] = true
	}
	data, err := service.GetLeaderboard(c.Request.Context(), period, metric, userID, publicModels)
	if err != nil {
		common.SysError("leaderboard aggregation failed: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Unable to load leaderboard"})
		return
	}
	common.ApiSuccess(c, data)
}
