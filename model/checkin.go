package model

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// Checkin 签到记录
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // 格式: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord 用于API返回的签到记录（不包含敏感字段）
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

func (Checkin) TableName() string {
	return "checkins"
}

// GetUserCheckinRecords 获取用户在指定日期范围内的签到记录
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday 检查用户今天是否已签到
func HasCheckedInToday(userId int) (bool, error) {
	today := time.Now().Format("2006-01-02")
	var count int64
	err := DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, today).
		Count(&count).Error
	return count > 0, err
}

// UserCheckin retains the non-HTTP entry point for callers without a context.
func UserCheckin(userId int) (*Checkin, error) {
	return UserCheckinContext(context.Background(), userId)
}

// UserCheckinContext commits the daily record and wallet credit together on all
// supported databases. Locking the wallet also serializes other quota changes.
func UserCheckinContext(ctx context.Context, userId int) (*Checkin, error) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		return nil, errors.New("Check-in is disabled")
	}
	if userId <= 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if setting.MinQuota < 0 || setting.MaxQuota < setting.MinQuota || setting.MaxQuota > common.MaxWalletQuota {
		return nil, errors.New("Invalid check-in reward configuration")
	}

	// 计算随机额度奖励
	quotaAwarded := setting.MinQuota
	if setting.MaxQuota > setting.MinQuota {
		quotaAwarded = setting.MinQuota + rand.Intn(setting.MaxQuota-setting.MinQuota+1)
	}

	now := time.Now()
	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  now.Format("2006-01-02"),
		QuotaAwarded: quotaAwarded,
		CreatedAt:    now.Unix(),
	}
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userId).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&Checkin{}).Where("user_id = ? AND checkin_date = ?", userId, checkin.CheckinDate).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("Already checked in today")
		}
		if user.Quota < -common.MaxWalletQuota || user.Quota > common.MaxWalletQuota-quotaAwarded {
			return ErrWalletQuotaLimitExceeded
		}
		if err := tx.Create(checkin).Error; err != nil {
			return err
		}
		if quotaAwarded > 0 {
			result := tx.Model(&User{}).Where("id = ?", userId).Update("quota", user.Quota+quotaAwarded)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return gorm.ErrRecordNotFound
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Apply only this committed reward, preserving outstanding reservations.
	if quotaAwarded > 0 {
		if err := cacheIncrUserQuota(userId, int64(quotaAwarded)); err != nil {
			common.SysError(common.LogText("failed to sync check-in reward for user %d: %s", userId, err))
		}
	}

	return checkin, nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]interface{}, error) {
	first, err := time.Parse("2006-01", month)
	if err != nil || first.Year() < 1 || len(month) != 7 {
		return nil, errors.New("Invalid check-in month")
	}
	startDate := first.Format("2006-01-02")
	endDate := first.AddDate(0, 1, -1).Format("2006-01-02")

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 转换为不包含敏感字段的记录
	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
		}
	}

	// 检查今天是否已签到
	hasCheckedToday, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}

	// 获取用户所有时间的签到统计
	var totalCheckins int64
	var totalQuota int64
	if err := DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_quota":      totalQuota,      // 所有时间累计获得的额度
		"total_checkins":   totalCheckins,   // 所有时间累计签到次数
		"checkin_count":    len(records),    // 本月签到次数
		"checked_in_today": hasCheckedToday, // 今天是否已签到
		"records":          checkinRecords,  // 本月签到记录详情（不含id和user_id）
	}, nil
}
