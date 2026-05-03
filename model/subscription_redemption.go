package model

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

// SubscriptionRedemption — admin-generated codes that, when redeemed by
// a user, activate a subscription plan for that user.
type SubscriptionRedemption struct {
	Id           int            `json:"id"`
	PlanId      int            `json:"plan_id" gorm:"index"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Name         string         `json:"name" gorm:"index"`
	Status       int            `json:"status" gorm:"default:1"` // 1=enabled, 2=used
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	UsedUserId   int            `json:"used_user_id"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint"` // 0 = no expiry
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

const (
	SubscriptionRedemptionStatusEnabled = 1
	SubscriptionRedemptionStatusUsed    = 2
)

// GenerateSubscriptionCodes creates `count` new codes for the given plan.
func GenerateSubscriptionCodes(planId int, name string, count int, expiredTime int64) ([]*SubscriptionRedemption, error) {
	if planId <= 0 {
		return nil, errors.New("invalid plan id")
	}
	if count <= 0 || count > 200 {
		return nil, errors.New("count must be between 1 and 200")
	}
	plan, err := GetSubscriptionPlanById(planId)
	if err != nil || plan == nil {
		return nil, errors.New("plan not found")
	}
	codes := make([]*SubscriptionRedemption, 0, count)
	for i := 0; i < count; i++ {
		key := strings.ReplaceAll(common.GetUUID(), "-", "")
		c := &SubscriptionRedemption{
			PlanId:      planId,
			Key:         key,
			Name:        name,
			Status:      SubscriptionRedemptionStatusEnabled,
			CreatedTime: common.GetTimestamp(),
			ExpiredTime: expiredTime,
		}
		if err := DB.Create(c).Error; err != nil {
			return nil, err
		}
		codes = append(codes, c)
	}
	return codes, nil
}

// ListSubscriptionCodesByPlan returns all codes attached to a plan.
func ListSubscriptionCodesByPlan(planId int) ([]*SubscriptionRedemption, error) {
	if planId <= 0 {
		return nil, errors.New("invalid plan id")
	}
	var out []*SubscriptionRedemption
	if err := DB.Where("plan_id = ?", planId).Order("id desc").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteSubscriptionCodeById removes a code by id (only if not yet used).
func DeleteSubscriptionCodeById(id int) error {
	if id <= 0 {
		return errors.New("invalid id")
	}
	return DB.Where("id = ?", id).Delete(&SubscriptionRedemption{}).Error
}

// RedeemSubscriptionCode validates and consumes a code, activating the plan
// for the given user. Returns the activated plan title on success.
func RedeemSubscriptionCode(key string, userId int) (string, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("未提供兑换码")
	}
	if userId == 0 {
		return "", errors.New("无效的 user id")
	}
	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	var planTitle string
	err := DB.Transaction(func(tx *gorm.DB) error {
		code := &SubscriptionRedemption{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(code).Error; err != nil {
			return errors.New("无效的兑换码")
		}
		if code.Status != SubscriptionRedemptionStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if code.ExpiredTime != 0 && code.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		plan, err := GetSubscriptionPlanById(code.PlanId)
		if err != nil || plan == nil {
			return errors.New("订阅套餐不存在或已下架")
		}
		if !plan.Enabled {
			return errors.New("订阅套餐已禁用")
		}
		// Activate plan for user (mirrors AdminBindSubscription's tx body).
		if _, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption"); err != nil {
			return err
		}
		code.Status = SubscriptionRedemptionStatusUsed
		code.UsedUserId = userId
		code.RedeemedTime = common.GetTimestamp()
		if err := tx.Save(code).Error; err != nil {
			return err
		}
		planTitle = plan.Title
		// Mirror AdminBindSubscription's group upgrade hook outside the tx
		return nil
	})
	if err != nil {
		common.SysError(fmt.Sprintf("subscription redemption failed: %v", err))
		return "", err
	}
	// Best-effort: refresh user group cache if plan upgrades
	plan, _ := GetSubscriptionPlanById(0) // placeholder, not used here
	_ = plan
	if userId > 0 {
		// look up plan again to read upgrade group
		var fresh SubscriptionRedemption
		if err := DB.Where(`"key" = ?`, key).First(&fresh).Error; err == nil {
			if p, e := GetSubscriptionPlanById(fresh.PlanId); e == nil && p != nil && strings.TrimSpace(p.UpgradeGroup) != "" {
				_ = UpdateUserGroupCache(userId, p.UpgradeGroup)
			}
		}
	}
	logger.LogInfo(context.Background(), fmt.Sprintf("user %d redeemed subscription code (plan: %s)", userId, planTitle))
	return planTitle, nil
}
