package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1;index:idx_user_id_id,priority:2"`
	UserId           int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type"`
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

type RecordTaskBillingLogParams struct {
	UserId    int
	LogType   int
	Content   string
	ChannelId int
	ModelName string
	Quota     int
	TokenId   int
	Group     string
	Other     map[string]interface{}
}

func RecordTaskBillingLog(params RecordTaskBillingLogParams) {
	if params.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(params.UserId, false)
	tokenName := ""
	if params.TokenId > 0 {
		if token, err := GetTokenById(params.TokenId); err == nil {
			tokenName = token.Name
		}
	}
	log := &Log{
		UserId:    params.UserId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      params.LogType,
		Content:   params.Content,
		TokenName: tokenName,
		ModelName: params.ModelName,
		Quota:     params.Quota,
		ChannelId: params.ChannelId,
		TokenId:   params.TokenId,
		Group:     params.Group,
		Other:     common.MapToJsonStr(params.Other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record task billing log: " + err.Error())
	}
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("logs.type = ?", logType)
	}

	if modelName != "" {
		tx = tx.Where("logs.model_name like ?", modelName)
	}
	if username != "" {
		tx = tx.Where("logs.username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if channel != 0 {
		tx = tx.Where("logs.channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
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
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB.Where("logs.user_id = ?", userId)
	} else {
		tx = LOG_DB.Where("logs.user_id = ? and logs.type = ?", userId, logType)
	}

	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return nil, 0, err
		}
		tx = tx.Where("logs.model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
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
	Date     string `json:"date"`
	Quota    int64  `json:"quota"`
	Requests int64  `json:"requests"`
	Tokens   int64  `json:"tokens"`
}

func GetConsumptionByDay(startTimestamp, endTimestamp int64) ([]DailyConsumption, error) {
	var dateExpr string
	switch common.LogSqlType {
	case common.DatabaseTypePostgreSQL:
		dateExpr = "TO_CHAR(TO_TIMESTAMP(created_at), 'YYYY-MM-DD')"
	case common.DatabaseTypeMySQL:
		dateExpr = "DATE(FROM_UNIXTIME(created_at))"
	default:
		dateExpr = "DATE(created_at, 'unixepoch')"
	}

	var results []DailyConsumption
	err := LOG_DB.Table("logs").
		Select(fmt.Sprintf("%s as date, COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens", dateExpr)).
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTimestamp, endTimestamp).
		Group("date").
		Order("date ASC").
		Find(&results).Error
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
		Select(logGroupCol + " as \"group\", COALESCE(SUM(quota), 0) as quota, COUNT(*) as requests, COALESCE(SUM(prompt_tokens) + SUM(completion_tokens), 0) as tokens").
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

type ErrorStats struct {
	TotalErrors int64 `json:"total_errors"`
	TotalQuota  int64 `json:"total_quota"`
}

func GetErrorStats(startTimestamp, endTimestamp int64) (ErrorStats, error) {
	var stats ErrorStats
	tx := LOG_DB.Table("logs").
		Select("COUNT(*) as total_errors, COALESCE(SUM(quota), 0) as total_quota").
		Where("type = ?", LogTypeError)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Scan(&stats).Error
	return stats, err
}

type ErrorModelStat struct {
	ModelName string `json:"model_name"`
	Errors    int64  `json:"errors"`
}

func GetTopErrorModels(startTimestamp, endTimestamp int64, limit int) ([]ErrorModelStat, error) {
	var results []ErrorModelStat
	tx := LOG_DB.Table("logs").
		Select("model_name, COUNT(*) as errors").
		Where("type = ? AND model_name != ''", LogTypeError)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Group("model_name").Order("errors DESC").Limit(limit).Find(&results).Error
	return results, err
}

type ChannelModelCost struct {
	ChannelId   int    `json:"channel_id" gorm:"column:channel_id"`
	ChannelName string `json:"channel_name" gorm:"-"`
	ModelName   string `json:"model_name" gorm:"column:model_name"`
	Quota       int64  `json:"quota" gorm:"column:quota"`
	Requests    int64  `json:"requests" gorm:"column:requests"`
	Tokens      int64  `json:"tokens" gorm:"column:tokens"`
	AvgQuota    int64  `json:"avg_quota" gorm:"-"`
	AvgTokens   int64  `json:"avg_tokens" gorm:"-"`
}

func GetChannelModelCost(startTimestamp, endTimestamp int64, modelName string, limit int) ([]ChannelModelCost, error) {
	var results []ChannelModelCost
	tx := LOG_DB.Table("logs").
		Select("channel_id, model_name, SUM(quota) as quota, COUNT(*) as requests, SUM(prompt_tokens + completion_tokens) as tokens").
		Where("type = ? AND channel_id != 0 AND model_name != ''", LogTypeConsume)
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Group("channel_id, model_name").Order("quota DESC").Limit(limit).Find(&results).Error
	if err != nil {
		return nil, err
	}

	var channelIds []int
	for _, r := range results {
		channelIds = append(channelIds, r.ChannelId)
	}
	if len(channelIds) > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		DB.Table("channels").Select("id, name").Where("id IN ?", channelIds).Find(&channels)
		nameMap := make(map[int]string, len(channels))
		for _, ch := range channels {
			nameMap[ch.Id] = ch.Name
		}
		for i := range results {
			results[i].ChannelName = nameMap[results[i].ChannelId]
			if results[i].Requests > 0 {
				results[i].AvgQuota = results[i].Quota / results[i].Requests
				results[i].AvgTokens = results[i].Tokens / results[i].Requests
			}
		}
	}
	return results, nil
}

func GetDistinctConsumeModels(startTimestamp, endTimestamp int64) ([]string, error) {
	var models []string
	tx := LOG_DB.Table("logs").
		Distinct("model_name").
		Where("type = ? AND model_name != ''", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	err := tx.Order("model_name").Pluck("model_name", &models).Error
	return models, err
}

// channelCostFactor 返回每个渠道的成本系数：成本($) = 渠道消费($) × factor。
// factor = R / (Y × 全局站内汇率)，R=上游分组倍率，Y=该渠道汇率(1人民币=Y美元额度)。
// R 或 Y 为 0 的渠道 factor=0（视为自有渠道，无上游成本）。
func channelCostFactor() map[int]float64 {
	factors := make(map[int]float64)
	usdRate := operation_setting.USDExchangeRate
	if usdRate <= 0 {
		usdRate = 7.3
	}
	var channels []Channel
	DB.Select("id", "settings").Find(&channels)
	for _, ch := range channels {
		os := ch.GetOtherSettings()
		if os.UpstreamGroupRatio <= 0 || os.UpstreamExchangeRate <= 0 {
			continue
		}
		factors[ch.Id] = os.UpstreamGroupRatio / (os.UpstreamExchangeRate * usdRate)
	}
	return factors
}

// GetChannelCostSummary 返回区间内的上游总成本（quota$ 口径，与 quota 同单位）。
func GetChannelCostSummary(startTimestamp, endTimestamp int64) (int64, error) {
	factors := channelCostFactor()
	if len(factors) == 0 {
		return 0, nil
	}
	type row struct {
		ChannelId int   `gorm:"column:channel_id"`
		Quota     int64 `gorm:"column:quota"`
	}
	var rows []row
	tx := LOG_DB.Table("logs").
		Select("channel_id, COALESCE(SUM(quota), 0) as quota").
		Where("type = ? AND channel_id != 0", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if err := tx.Group("channel_id").Find(&rows).Error; err != nil {
		return 0, err
	}
	var total float64
	for _, r := range rows {
		if f, ok := factors[r.ChannelId]; ok {
			total += float64(r.Quota) * f
		}
	}
	return int64(total), nil
}

type DailyCost struct {
	Date string `json:"date"`
	Cost int64  `json:"cost"`
}

// GetChannelCostByDay 返回区间内每天的上游成本（quota$ 口径）。
func GetChannelCostByDay(startTimestamp, endTimestamp int64) (map[string]int64, error) {
	factors := channelCostFactor()
	if len(factors) == 0 {
		return map[string]int64{}, nil
	}
	var dateExpr string
	switch common.LogSqlType {
	case common.DatabaseTypePostgreSQL:
		dateExpr = "TO_CHAR(TO_TIMESTAMP(created_at), 'YYYY-MM-DD')"
	case common.DatabaseTypeMySQL:
		dateExpr = "DATE(FROM_UNIXTIME(created_at))"
	default:
		dateExpr = "DATE(created_at, 'unixepoch')"
	}
	type row struct {
		Date      string `gorm:"column:date"`
		ChannelId int    `gorm:"column:channel_id"`
		Quota     int64  `gorm:"column:quota"`
	}
	var rows []row
	tx := LOG_DB.Table("logs").
		Select(fmt.Sprintf("%s as date, channel_id, COALESCE(SUM(quota), 0) as quota", dateExpr)).
		Where("type = ? AND channel_id != 0", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if err := tx.Group(fmt.Sprintf("%s, channel_id", dateExpr)).Find(&rows).Error; err != nil {
		return nil, err
	}
	costByDate := make(map[string]float64)
	for _, r := range rows {
		if f, ok := factors[r.ChannelId]; ok {
			costByDate[r.Date] += float64(r.Quota) * f
		}
	}
	result := make(map[string]int64, len(costByDate))
	for d, v := range costByDate {
		result[d] = int64(v)
	}
	return result, nil
}
