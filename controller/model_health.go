package controller

import (
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetAllModelHealthStatus(c *gin.Context) {
	if names, supplied := c.Request.URL.Query()["model"]; supplied {
		if len(names) != 1 || names[0] == "" || len(names[0]) > 512 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid model name"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": model.GetModelHealthByModel(names[0])})
		return
	}
	data := model.GetAllModelHealth()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

func GetModelHealthStatus(c *gin.Context) {
	modelName, err := url.PathUnescape(c.Param("model"))
	if err != nil || modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid model name"})
		return
	}
	data := model.GetModelHealthByModel(modelName)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
