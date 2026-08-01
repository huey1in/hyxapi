package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func AdminListModelPricings(c *gin.Context) {
	rows, err := model.ListModelPricings(true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func AdminSaveModelPricing(c *gin.Context) {
	var pricing model.ModelPricing
	if err := common.DecodeJson(c.Request.Body, &pricing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的模型价格参数"})
		return
	}
	if err := model.SaveModelPricing(&pricing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	model.RecordAuditLog(c, model.AuditUpdate, "model_pricing", pricing.ID, "保存模型价格 "+pricing.ModelName)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    pricing,
	})
}

func AdminDeleteModelPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的模型价格 ID"})
		return
	}
	if err := model.DeleteModelPricingByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "模型价格不存在"})
			return
		}
		common.ApiError(c, err)
		return
	}
	model.RecordAuditLog(c, model.AuditDelete, "model_pricing", id, "删除模型价格")
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
