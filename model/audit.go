package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	AuditCreate  = "create"
	AuditUpdate  = "update"
	AuditDelete  = "delete"
	AuditEnable  = "enable"
	AuditDisable = "disable"
)

func RecordLegacyAuditLog(c *gin.Context, action, resourceType string, resourceId int, detail string) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	ip := c.ClientIP()
	ts := common.GetTimestamp()
	requestID := c.GetString(common.RequestIdKey)

	other := map[string]interface{}{
		"action":        action,
		"resource_type": resourceType,
		"resource_id":   resourceId,
	}

	gopool.Go(func() {
		log := &Log{
			UserId:    userId,
			Username:  username,
			CreatedAt: ts,
			Type:      LogTypeManage,
			Content:   detail,
			Ip:        ip,
			Other:     common.MapToJsonStr(other),
			RequestId: requestID,
		}
		if err := createLog(log); err != nil {
			common.SysError(fmt.Sprintf("failed to record legacy audit log: %s", err.Error()))
		}
	})
}

func GetLegacyAuditLogs(startTimestamp, endTimestamp int64, username, keyword string, startIdx, num int) (logs []*Log, total int64, err error) {
	tx := LOG_DB.Where("type = ?", LogTypeManage)

	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if keyword != "" {
		tx = tx.Where("content LIKE ?", "%"+keyword+"%")
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	var result []*Log
	order := "id desc"
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		order = clickHouseLogOrder("")
	}
	err = tx.Order(order).Limit(num).Offset(startIdx).Find(&result).Error
	if err != nil {
		return nil, 0, err
	}
	if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
		assignDisplayLogIds(result, startIdx)
	}

	backfillChannelNames(result)
	return result, total, nil
}

func backfillChannelNames(logs []*Log) {
	var ids []int
	for _, l := range logs {
		if l.ChannelId != 0 {
			ids = append(ids, l.ChannelId)
		}
	}
	if len(ids) == 0 {
		return
	}

	var channels []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", ids).Find(&channels).Error; err != nil {
		return
	}
	m := make(map[int]string, len(channels))
	for _, ch := range channels {
		m[ch.Id] = ch.Name
	}
	for i := range logs {
		logs[i].ChannelName = m[logs[i].ChannelId]
	}
}
