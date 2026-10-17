package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
)

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1;index:idx_user_id_id,priority:2"`
	UserId           int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1;index:idx_logs_user_type_created,priority:1"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type;index:idx_logs_type_created,priority:2;index:idx_logs_user_type_created,priority:3"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type;index:idx_logs_type_created,priority:1;index:idx_logs_user_type_created,priority:2"`
	Content          string `json:"content"`
	Username         string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName        string `json:"token_name" gorm:"index;default:''"`
	ModelName        string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream"`
	ChannelId        int    `json:"channel" gorm:"index"`
	ChannelName      string `json:"channel_name" gorm:"->"`
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Ip               string `json:"ip" gorm:"index;default:''"`
	RequestId        string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	Other            string `json:"other"`
}

// don't use iota, avoid change log type value
const (
	LogTypeUnknown = 0
	LogTypeTopup   = 1
	LogTypeConsume = 2
	LogTypeManage  = 3
	LogTypeSystem  = 4
	LogTypeError   = 5
	LogTypeRefund  = 6
)

func formatUserLogs(logs []*Log, startIdx int) {
	for i := range logs {
		logs[i].ChannelName = ""
		var otherMap map[string]interface{}
		otherMap, _ = common.StrToMap(logs[i].Other)
		if otherMap != nil {
			// Remove admin-only debug fields.
			delete(otherMap, "admin_info")
			// Remove operation-audit details (operator/route info), admin-only.
			delete(otherMap, "audit_info")
			// delete(otherMap, "reject_reason")
			delete(otherMap, "stream_status")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = startIdx + i + 1
	}
}

func GetLogByTokenId(tokenId int) (logs []*Log, err error) {
	err = LOG_DB.Model(&Log{}).Where("token_id = ?", tokenId).Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	formatUserLogs(logs, 0)
	return logs, err
}

func RecordLog(userId int, logType int, content string) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

// RecordLogWithAdminInfo 记录操作日志，并将管理员相关信息存入 Other.admin_info，
func RecordLogWithAdminInfo(userId int, logType int, content string, adminInfo map[string]interface{}) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	if len(adminInfo) > 0 {
		other := map[string]interface{}{
			"admin_info": adminInfo,
		}
		log.Other = common.MapToJsonStr(other)
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

// buildOpField 构建语言无关的操作描述（写入 Other.op）。
// 前端依据 action(稳定操作标识) + params(结构化参数) 在渲染期用 i18n 本地化展示，
// 因此不在数据库中存储自然语言句子。
func buildOpField(action string, params map[string]interface{}) map[string]interface{} {
	op := map[string]interface{}{
		"action": action,
	}
	if len(params) > 0 {
		op["params"] = params
	}
	return op
}

// RecordOperationAuditLog 记录管理/高危操作审计日志（type=LogTypeManage）。
// logUserId 为日志归属者，管理审计日志应归属实际操作者。content 为英文兜底文本
// （供导出使用）；action+params 写入 Other.op 供前端本地化渲染（普通用户可见）。
// adminInfo 存放操作者身份（写入 Other.admin_info，普通用户查询时剥离）；
// auditInfo 存放路由/方法/结果等中间件兜底信息（写入 Other.audit_info，剥离）。
func RecordOperationAuditLog(logUserId int, content string, ip string, action string, params map[string]interface{}, adminInfo map[string]interface{}, auditInfo map[string]interface{}) {
	username, _ := GetUsernameById(logUserId, false)
	other := map[string]interface{}{
		"op": buildOpField(action, params),
	}
	if len(adminInfo) > 0 {
		other["admin_info"] = adminInfo
	}
	if len(auditInfo) > 0 {
		other["audit_info"] = auditInfo
	}
	log := &Log{
		UserId:    logUserId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      LogTypeManage,
		Content:   content,
		Ip:        ip,
		Other:     common.MapToJsonStr(other),
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		common.SysLog("failed to record operation audit log: " + err.Error())
	}
}

func RecordTopupLog(userId int, content string, callerIp string, paymentMethod string, callbackPaymentMethod string) {
	username, _ := GetUsernameById(userId, false)
	adminInfo := map[string]interface{}{
		"server_ip":               common.GetIp(),
		"node_name":               common.NodeName,
		"caller_ip":               callerIp,
		"payment_method":          paymentMethod,
		"callback_payment_method": callbackPaymentMethod,
		"version":                 common.Version,
	}
	other := map[string]interface{}{
		"admin_info": adminInfo,
	}
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      LogTypeTopup,
		Content:   content,
		Ip:        callerIp,
		Other:     common.MapToJsonStr(other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record topup log: " + err.Error())
	}
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, content))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	otherStr := common.MapToJsonStr(other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeError,
		Content:          content,
		PromptTokens:     0,
		CompletionTokens: 0,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            0,
		ChannelId:        channelId,
		TokenId:          tokenId,
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId: requestId,
		Other:     otherStr,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
}

type RecordConsumeLogParams struct {
	ChannelId        int                    `json:"channel_id"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	ModelName        string                 `json:"model_name"`
	TokenName        string                 `json:"token_name"`
	Quota            int                    `json:"quota"`
	Content          string                 `json:"content"`
	TokenId          int                    `json:"token_id"`
	UseTimeSeconds   int                    `json:"use_time_seconds"`
	IsStream         bool                   `json:"is_stream"`
	Group            string                 `json:"group"`
	Other            map[string]interface{} `json:"other"`
}

func RecordConsumeLog(c *gin.Context, userId int, params RecordConsumeLogParams) {
	if !common.LogConsumeEnabled {
		return
	}
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, params=%s", userId, common.GetJsonString(params)))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	otherStr := common.MapToJsonStr(params.Other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeConsume,
		Content:          params.Content,
		PromptTokens:     params.PromptTokens,
		CompletionTokens: params.CompletionTokens,
		TokenName:        params.TokenName,
		ModelName:        params.ModelName,
		Quota:            params.Quota,
		ChannelId:        params.ChannelId,
		TokenId:          params.TokenId,
		UseTime:          params.UseTimeSeconds,
		IsStream:         params.IsStream,
		Group:            params.Group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId: requestId,
		Other:     otherStr,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled {
		gopool.Go(func() {
			LogQuotaData(userId, username, params.ModelName, params.Quota, common.GetTimestamp(), params.PromptTokens+params.CompletionTokens)
		})
	}
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string) (logs []*Log, total int64, err error) {
	tx, err := buildLogQuery(LogFilter{Type: logType, StartTimestamp: startTimestamp, EndTimestamp: endTimestamp, ModelName: modelName, Username: username, TokenName: tokenName, Channel: channel, Group: group, RequestId: requestId}, 0)
	if err != nil {
		return nil, 0, err
	}
	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
	}

	if channelIds.Len() > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if common.MemoryCacheEnabled {
			// Cache get channel
			for _, channelId := range channelIds.Items() {
				if cacheChannel, err := CacheGetChannel(channelId); err == nil {
					channels = append(channels, struct {
						Id   int    `gorm:"column:id"`
						Name string `gorm:"column:name"`
					}{
						Id:   channelId,
						Name: cacheChannel.Name,
					})
				}
			}
		} else {
			// Bulk query channels from DB
			if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
				return logs, total, err
			}
		}
		channelMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, err
}

const logSearchCountLimit = 10000

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string, requestId string) (logs []*Log, total int64, err error) {
	tx, err := buildLogQuery(LogFilter{Type: logType, StartTimestamp: startTimestamp, EndTimestamp: endTimestamp, ModelName: modelName, TokenName: tokenName, Group: group, RequestId: requestId}, userId)
	if err != nil {
		return nil, 0, err
	}
	err = tx.Model(&Log{}).Limit(logSearchCountLimit).Count(&total).Error
	if err != nil {
		common.SysError("failed to count user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		common.SysError("failed to search user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}

	formatUserLogs(logs, startIdx)
	return logs, total, err
}

type Stat struct {
	Quota    int   `json:"quota"`
	Tokens   int64 `json:"tokens"`
	Requests int   `json:"requests"`
}

type ActiveOperationsStat struct {
	Users    int64 `json:"users"`
	Models   int64 `json:"models"`
	Channels int64 `json:"channels"`
}

type RequestHealthStat struct {
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	ErrorRequests     int64   `json:"error_requests"`
	SuccessRate       float64 `json:"success_rate"`
	RPM               float64 `json:"rpm"`
	AvgLatencySeconds float64 `json:"avg_latency_seconds"`
}

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string) (stat Stat, err error) {
	// 统计指定筛选条件与时间范围内的消费额度、token 总量、请求数
	tx := LOG_DB.Table("logs").Select("sum(quota) quota, sum(prompt_tokens) + sum(completion_tokens) tokens, count(*) requests")

	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return stat, err
		}
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
	}

	tx = tx.Where("type = ?", LogTypeConsume)

	if err := tx.Scan(&stat).Error; err != nil {
		common.SysError("failed to query log stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}

	return stat, nil
}

func GetActiveOperationsStat(startTimestamp, endTimestamp int64) (stat ActiveOperationsStat, err error) {
	tx := LOG_DB.Table("logs").Where("type = ?", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err = tx.Select(`
		COUNT(DISTINCT NULLIF(user_id, 0)) as users,
		COUNT(DISTINCT NULLIF(model_name, '')) as models,
		COUNT(DISTINCT NULLIF(channel_id, 0)) as channels
	`).Scan(&stat).Error
	return stat, err
}

func GetRequestHealthStat(startTimestamp, endTimestamp int64) (stat RequestHealthStat, err error) {
	tx := LOG_DB.Table("logs").Where("type IN ?", []int{LogTypeConsume, LogTypeError})
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err = tx.Select(`
		COUNT(*) as total_requests,
		COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as success_requests,
		COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as error_requests,
		COALESCE(AVG(CASE WHEN type = ? AND use_time > 0 THEN use_time ELSE NULL END), 0) as avg_latency_seconds
	`, LogTypeConsume, LogTypeError, LogTypeConsume).Scan(&stat).Error
	if err != nil {
		return stat, err
	}
	if stat.TotalRequests > 0 {
		stat.SuccessRate = float64(stat.SuccessRequests) / float64(stat.TotalRequests) * 100
	}
	if startTimestamp != 0 && endTimestamp > startTimestamp {
		minutes := float64(endTimestamp-startTimestamp) / 60
		if minutes < 1 {
			minutes = 1
		}
		stat.RPM = float64(stat.TotalRequests) / minutes
	}
	return stat, nil
}

func DeleteOldLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	var total int64 = 0

	for {
		if nil != ctx.Err() {
			return total, ctx.Err()
		}

		result := LOG_DB.Where("created_at < ?", targetTimestamp).Limit(limit).Delete(&Log{})
		if nil != result.Error {
			return total, result.Error
		}

		total += result.RowsAffected

		if result.RowsAffected < int64(limit) {
			break
		}
	}

	return total, nil
}

// ModelGroupLogStat holds aggregated log stats for a model+group in a time window.
type ModelGroupLogStat struct {
	Total        int64 // total requests (consume + error)
	Errors       int64 // error requests
	AvgLatencyMs int64 // average use_time in ms (from successful requests)
	PromptTokens int64 // successful prompt tokens
	CacheTokens  int64 // successful cache read tokens
}

// GetModelGroupLogStat aggregates log entries for a model+group since a given timestamp.
func GetModelGroupLogStat(modelName, group string, since int64) (*ModelGroupLogStat, error) {
	return GetModelGroupLogStatRange(modelName, group, since, time.Now().Unix()+1)
}

// GetModelGroupLogStatRange aggregates log entries for a model+group in [since, until).
func GetModelGroupLogStatRange(modelName, group string, since, until int64) (*ModelGroupLogStat, error) {
	var stat ModelGroupLogStat

	// Count total requests (type 2 = consume, type 5 = error)
	var totalRow struct{ Cnt int64 }
	err := LOG_DB.Model(&Log{}).
		Select("count(*) as cnt").
		Where("model_name = ? AND \"group\" = ? AND created_at >= ? AND created_at < ? AND type IN (?, ?)", modelName, group, since, until, LogTypeConsume, LogTypeError).
		Scan(&totalRow).Error
	if err != nil {
		return nil, err
	}
	stat.Total = totalRow.Cnt

	if stat.Total == 0 {
		return &stat, nil
	}

	// Count errors
	var errRow struct{ Cnt int64 }
	LOG_DB.Model(&Log{}).
		Select("count(*) as cnt").
		Where("model_name = ? AND \"group\" = ? AND created_at >= ? AND created_at < ? AND type = ?", modelName, group, since, until, LogTypeError).
		Scan(&errRow)
	stat.Errors = errRow.Cnt

	// Average latency from successful requests (use_time is in seconds)
	var latRow struct{ Avg float64 }
	LOG_DB.Model(&Log{}).
		Select("COALESCE(AVG(use_time), 0) as avg").
		Where("model_name = ? AND \"group\" = ? AND created_at >= ? AND created_at < ? AND type = ? AND use_time > 0", modelName, group, since, until, LogTypeConsume).
		Scan(&latRow)
	stat.AvgLatencyMs = int64(latRow.Avg * 1000)

	var cacheRow struct {
		PromptTokens int64
		CacheTokens  int64
	}
	LOG_DB.Model(&Log{}).
		Select(fmt.Sprintf("COALESCE(SUM(prompt_tokens), 0) as prompt_tokens, COALESCE(SUM(%s), 0) as cache_tokens", jsonIntExtract("other", "cache_tokens"))).
		Where("model_name = ? AND \"group\" = ? AND created_at >= ? AND created_at < ? AND type = ?", modelName, group, since, until, LogTypeConsume).
		Scan(&cacheRow)
	stat.PromptTokens = cacheRow.PromptTokens
	stat.CacheTokens = cacheRow.CacheTokens

	return &stat, nil
}

type UserConsumption struct {
	UserId   int    `json:"user_id"`
	Username string `json:"username"`
	Quota    int64  `json:"quota"`
	Requests int64  `json:"requests"`
	Tokens   int64  `json:"tokens"`
}

func GetTopConsumingUsers(startTimestamp, endTimestamp int64, limit int) ([]UserConsumption, error) {
	var results []UserConsumption
	tx := LOG_DB.Table("logs").
		Select("user_id, username, COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens").
		Where("type = ?", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Group("user_id, username").Order("quota DESC").Limit(limit).Find(&results).Error
	return results, err
}

type ModelConsumption struct {
	ModelName string `json:"model_name"`
	Quota     int64  `json:"quota"`
	Requests  int64  `json:"requests"`
	Tokens    int64  `json:"tokens"`
}

func GetModelConsumption(startTimestamp, endTimestamp int64, limit int) ([]ModelConsumption, error) {
	var results []ModelConsumption
	tx := LOG_DB.Table("logs").
		Select("model_name, COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens").
		Where("type = ?", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Group("model_name").Order("quota DESC").Limit(limit).Find(&results).Error
	return results, err
}

type DailyConsumption struct {
	Date             string `json:"date"`
	BucketStart      int64  `json:"bucket_start"`
	Quota            int64  `json:"quota"`
	Requests         int64  `json:"requests"`
	Tokens           int64  `json:"tokens"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	CacheTokens      int64  `json:"cache_tokens"`
}

func tokenUsageBucketExpression(startTimestamp, bucketSeconds int64) string {
	switch common.LogSqlType {
	case common.DatabaseTypePostgreSQL:
		return fmt.Sprintf("%d + FLOOR((created_at - %d)::numeric / %d)::bigint * %d", startTimestamp, startTimestamp, bucketSeconds, bucketSeconds)
	case common.DatabaseTypeMySQL:
		return fmt.Sprintf("%d + FLOOR((created_at - %d) / %d) * %d", startTimestamp, startTimestamp, bucketSeconds, bucketSeconds)
	default:
		return fmt.Sprintf("%d + CAST((created_at - %d) / %d AS INTEGER) * %d", startTimestamp, startTimestamp, bucketSeconds, bucketSeconds)
	}
}

func dailyLogDateExpression() string {
	switch common.LogSqlType {
	case common.DatabaseTypePostgreSQL:
		return "TO_CHAR(TO_TIMESTAMP(created_at), 'YYYY-MM-DD')"
	case common.DatabaseTypeMySQL:
		return "DATE(FROM_UNIXTIME(created_at))"
	default:
		return "DATE(created_at, 'unixepoch')"
	}
}

func GetConsumptionByDay(startTimestamp, endTimestamp int64) ([]DailyConsumption, error) {
	dateExpr := dailyLogDateExpression()

	var results []DailyConsumption
	err := LOG_DB.Table("logs").
		Select(fmt.Sprintf("%s as date, COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens", dateExpr)).
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTimestamp, endTimestamp).
		Group("date").
		Order("date ASC").
		Find(&results).Error
	return results, err
}

func GetTokenUsageByBucket(ctx context.Context, userID int, startTimestamp, endTimestamp, bucketSeconds int64) ([]DailyConsumption, error) {
	if bucketSeconds < 1 {
		bucketSeconds = 1
	}
	bucketExpr := tokenUsageBucketExpression(startTimestamp, bucketSeconds)
	// Keep the dashboard query on indexed/native columns. Parsing the large
	// request metadata JSON for every log can exceed the endpoint timeout.
	selectExpr := fmt.Sprintf("%s as bucket_start, COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens), 0) as prompt_tokens, COALESCE(SUM(completion_tokens), 0) as completion_tokens, 0 as cache_tokens, COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) as tokens", bucketExpr)
	tx := LOG_DB.WithContext(ctx).Table("logs").
		Select(selectExpr).
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTimestamp, endTimestamp)
	if userID > 0 {
		tx = tx.Where("user_id = ?", userID)
	}
	var results []DailyConsumption
	err := tx.Group("bucket_start").Order("bucket_start ASC").Find(&results).Error
	return results, err
}

type ChannelConsumption struct {
	ChannelId   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Quota       int64  `json:"quota"`
	Requests    int64  `json:"requests"`
	Tokens      int64  `json:"tokens"`
}

func GetChannelConsumption(startTimestamp, endTimestamp int64, limit int) ([]ChannelConsumption, error) {
	var results []ChannelConsumption
	tx := LOG_DB.Table("logs").
		Select("channel_id, COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens").
		Where("type = ?", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Group("channel_id").Order("quota DESC").Limit(limit).Find(&results).Error
	if err != nil {
		return nil, err
	}
	for i := range results {
		var name string
		DB.Table("channels").Select("name").Where("id = ?", results[i].ChannelId).Scan(&name)
		results[i].ChannelName = name
	}
	return results, nil
}

type GroupConsumption struct {
	Group    string `json:"group"`
	Quota    int64  `json:"quota"`
	Requests int64  `json:"requests"`
	Tokens   int64  `json:"tokens"`
}

func GetGroupConsumption(startTimestamp, endTimestamp int64, limit int) ([]GroupConsumption, error) {
	var results []GroupConsumption
	tx := LOG_DB.Table("logs").
		Select(logGroupCol+" as \"group\", COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens").
		Where("type = ?", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Group(logGroupCol).Order("quota DESC").Limit(limit).Find(&results).Error
	return results, err
}

type ChannelRiskStat struct {
	ChannelId         int     `json:"channel_id"`
	ChannelName       string  `json:"channel_name"`
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	ErrorRequests     int64   `json:"error_requests"`
	ErrorRate         float64 `json:"error_rate"`
	AvgLatencySeconds float64 `json:"avg_latency_seconds"`
}

func GetTopRiskChannels(startTimestamp, endTimestamp int64, limit int) ([]ChannelRiskStat, error) {
	var results []ChannelRiskStat
	tx := LOG_DB.Table("logs").
		Select(`
			channel_id,
			COUNT(*) as total_requests,
			COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as success_requests,
			COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as error_requests,
			COALESCE(AVG(CASE WHEN type = ? AND use_time > 0 THEN use_time ELSE NULL END), 0) as avg_latency_seconds
		`, LogTypeConsume, LogTypeError, LogTypeConsume).
		Where("type IN ? AND channel_id != 0", []int{LogTypeConsume, LogTypeError})
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if limit <= 0 {
		limit = 10
	}
	err := tx.Group("channel_id").Order("error_requests DESC, avg_latency_seconds DESC").Limit(limit).Find(&results).Error
	if err != nil {
		return nil, err
	}
	for i := range results {
		if results[i].TotalRequests > 0 {
			results[i].ErrorRate = float64(results[i].ErrorRequests) / float64(results[i].TotalRequests) * 100
		}
		var name string
		DB.Table("channels").Select("name").Where("id = ?", results[i].ChannelId).Scan(&name)
		results[i].ChannelName = name
	}
	return results, nil
}

type ModelRiskStat struct {
	ModelName         string  `json:"model_name"`
	TotalRequests     int64   `json:"total_requests"`
	SuccessRequests   int64   `json:"success_requests"`
	ErrorRequests     int64   `json:"error_requests"`
	ErrorRate         float64 `json:"error_rate"`
	AvgLatencySeconds float64 `json:"avg_latency_seconds"`
}

func GetTopRiskModels(startTimestamp, endTimestamp int64, limit int) ([]ModelRiskStat, error) {
	var results []ModelRiskStat
	tx := LOG_DB.Table("logs").
		Select(`
			model_name,
			COUNT(*) as total_requests,
			COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as success_requests,
			COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as error_requests,
			COALESCE(AVG(CASE WHEN type = ? AND use_time > 0 THEN use_time ELSE NULL END), 0) as avg_latency_seconds
		`, LogTypeConsume, LogTypeError, LogTypeConsume).
		Where("type IN ? AND model_name != ''", []int{LogTypeConsume, LogTypeError})
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if limit <= 0 {
		limit = 10
	}
	err := tx.Group("model_name").Order("error_requests DESC, avg_latency_seconds DESC").Limit(limit).Find(&results).Error
	if err != nil {
		return nil, err
	}
	for i := range results {
		if results[i].TotalRequests > 0 {
			results[i].ErrorRate = float64(results[i].ErrorRequests) / float64(results[i].TotalRequests) * 100
		}
	}
	return results, nil
}
