package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"

	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetRatioConfig(c *gin.Context) {
	if !ratio_setting.IsExposeRatioEnabled() {
		common.ApiErrorStatus(c, http.StatusForbidden, common.NewMessage("The ratio config API is not enabled"))
		return
	}

	data, err := getLocalPricingSyncData()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    effectivePricingSyncData(data),
	})
}
