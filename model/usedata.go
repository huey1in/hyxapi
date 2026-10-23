package model

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID              int
	Username, ModelName string
	Quota, TokenUsed    int
	CreatedAt           int64
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}
var quotaDataFlushLock sync.Mutex

func logQuotaDataCache(quotaData *QuotaData) {
	key := fmt.Sprintf("%d:%q:%q:%d", quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt)
	cached, ok := CacheQuotaData[key]
	if ok {
		cached.Count += quotaData.Count
		cached.Quota += quotaData.Quota
		cached.TokenUsed += quotaData.TokenUsed
		return
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	row := &QuotaData{UserID: params.UserID, Username: params.Username, ModelName: params.ModelName,
		CreatedAt: params.CreatedAt - params.CreatedAt%3600, Count: 1, Quota: params.Quota, TokenUsed: params.TokenUsed}
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(row)
}

func SaveQuotaDataCache() {
	// Serialize flushers while allowing request collectors to use the fresh cache.
	quotaDataFlushLock.Lock()
	defer quotaDataFlushLock.Unlock()
	// 1) Snapshot the current cache under the lock and immediately install
	//    a fresh map so concurrent LogQuotaData calls aren't blocked while
	//    we flush to the database.
	CacheQuotaDataLock.Lock()
	if len(CacheQuotaData) == 0 {
		CacheQuotaDataLock.Unlock()
		return
	}
	snapshot := CacheQuotaData
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()

	// 2) Flush the snapshot — DB work happens with no lock held.
	size := 0
	for _, quotaData := range snapshot {
		if err := saveQuotaDataRow(quotaData); err != nil {
			common.SysError(fmt.Sprintf("save dashboard data: %s", err))
			CacheQuotaDataLock.Lock()
			logQuotaDataCache(quotaData)
			CacheQuotaDataLock.Unlock()
			continue
		}
		size++
	}
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func saveQuotaDataRow(row *QuotaData) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var existing QuotaData
		err := tx.Where("user_id = ? AND username = ? AND model_name = ? AND created_at = ?",
			row.UserID, row.Username, row.ModelName, row.CreatedAt).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			copy := *row
			copy.Id = 0
			return tx.Create(&copy).Error
		}
		if err != nil {
			return err
		}
		return tx.Model(&QuotaData{}).Where("id = ?", existing.Id).Updates(map[string]any{
			"count": gorm.Expr("count + ?", row.Count), "quota": gorm.Expr("quota + ?", row.Quota),
			"token_used": gorm.Expr("token_used + ?", row.TokenUsed),
		}).Error
	})
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).Group("user_id, username, model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).Group("user_id, username, model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}
