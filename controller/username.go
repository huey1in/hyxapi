package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func CheckUsername(c *gin.Context) {
	username := strings.TrimSpace(c.Query("username"))
	if username == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(username) > 20 {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"available": false,
				"reason":    "length",
			},
		})
		return
	}
	exist, err := model.CheckUserExistOrDeleted(username, "")
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"available": !exist,
		},
	})
}
