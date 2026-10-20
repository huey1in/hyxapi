package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func MoveChannelPriority(c *gin.Context) {
	var request model.LegacyChannelPriorityMove
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	changes, err := model.MoveChannelPriority(request)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "channel", request.SourceID, "Moved channel priority")
	common.ApiSuccess(c, gin.H{"changes": changes})
}

func UpdateChannelPriorities(c *gin.Context) {
	var request struct {
		Changes []model.LegacyChannelPriorityChange `json:"changes"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateChannelPriorities(request.Changes); err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "channel", 0, "Updated channel priorities")
	common.ApiSuccess(c, nil)
}
