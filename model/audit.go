package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	AuditCreate  = "create"
	AuditUpdate  = "update"
	AuditDelete  = "delete"
	AuditEnable  = "enable"
	AuditDisable = "disable"
)

func RecordAuditLog(c *gin.Context, action, resourceType string, resourceId int, detail string) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	ip := c.ClientIP()
	ts := common.GetTimestamp()

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
		}
		LOG_DB.Create(log)
	})
}

func GetAuditLogs(startTimestamp, endTimestamp int64, username, keyword string, startIdx, num int) (logs []*Log, total int64, err error) {
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
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&result).Error
	if err != nil {
		return nil, 0, err
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

func GetAuditAdminNames() ([]string, error) {
	var names []string
	err := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeManage).
		Distinct("username").Where("username != ''").
		Order("username").Pluck("username", &names).Error
	return names, err
}

func GetAuditStats(startTimestamp, endTimestamp int64) (total int64, err error) {
	tx := LOG_DB.Model(&Log{}).Where("type = ?", LogTypeManage)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err = tx.Count(&total).Error
	return
}

func jsonExtract(field, key string) string {
	if common.UsingPostgreSQL {
		return field + "::jsonb->>'" + key + "'"
	}
	if common.UsingSQLite {
		return "json_extract(" + field + ", '$." + key + "')"
	}
	return "JSON_UNQUOTE(JSON_EXTRACT(" + field + ", '$." + key + "'))"
}

func jsonIntExtract(field, key string) string {
	if common.UsingPostgreSQL {
		return "COALESCE(NULLIF((NULLIF(" + field + ", '')::jsonb->>'" + key + "'), '')::bigint, 0)"
	}
	if common.UsingSQLite {
		return "CAST(COALESCE(NULLIF(json_extract(NULLIF(" + field + ", ''), '$." + key + "'), ''), '0') AS INTEGER)"
	}
	return "CAST(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(NULLIF(" + field + ", ''), '$." + key + "')), ''), '0') AS SIGNED)"
}

func GetAuditLogsByAction(action string, startTimestamp, endTimestamp int64, startIdx, num int) (logs []*Log, total int64, err error) {
	tx := LOG_DB.Where("type = ?", LogTypeManage)

	if action != "" {
		tx = tx.Where(gorm.Expr(jsonExtract("other", "action")+" = ?", action))
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

	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	return logs, total, err
}
