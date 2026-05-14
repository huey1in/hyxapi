package model

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

// SubscriptionRedemption — admin-generated codes that, when redeemed by
// a user, activate a subscription plan for that user.
type SubscriptionRedemption struct {
	Id           int            `json:"id"`
	PlanId      int            `json:"plan_id" gorm:"index"`
	Key          string         `json:"key" gorm:"type:varchar(32);uniqueIndex"`
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
		key := common.GenerateRedeemCode()
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
// for the given user.
//
// 行为：
//  1. 用户无 active 订阅 → 直接创建新订阅
//  2. 用户已有 active 订阅，且 plan_id 相同 → 续期：
//     - end_time += 套餐时长
//     - amount_total += plan.TotalAmount
//     - 限制快照（AllowedGroups/AllowedModels/ConcurrentLimit/RPMLimit）覆盖为新 plan 的值
//  3. 用户已有 active 订阅，且 plan_id 不同 → 升级：
//     - 旧订阅 status=cancelled，记录回退分组（如已升级）
//     - 创建新订阅
//
// 返回激活的套餐标题。
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

	var (
		planTitle string
		action    string // new | renew | upgrade
	)
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

		// 查用户当前 active 订阅
		var existing UserSubscription
		findErr := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND status = ?", userId, "active").
			First(&existing).Error
		hasActive := findErr == nil

		switch {
		case !hasActive:
			// 1. 无 active → 直接创建
			if _, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption"); err != nil {
				return err
			}
			action = "new"
		case existing.PlanId == plan.Id:
			// 2. 同套餐 → 续期
			if err := renewUserSubscriptionTx(tx, &existing, plan); err != nil {
				return err
			}
			action = "renew"
		default:
			// 3. 异套餐 → 升级：旧的标 cancelled、新的 active
			if err := cancelUserSubscriptionTx(tx, &existing); err != nil {
				return err
			}
			if _, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption"); err != nil {
				return err
			}
			action = "upgrade"
		}

		// 标记 code used
		code.Status = SubscriptionRedemptionStatusUsed
		code.UsedUserId = userId
		code.RedeemedTime = common.GetTimestamp()
		if err := tx.Save(code).Error; err != nil {
			return err
		}
		planTitle = plan.Title
		return nil
	})
	if err != nil {
		common.SysError(fmt.Sprintf("subscription redemption failed: %v", err))
		return "", err
	}
	logger.LogInfo(context.Background(), fmt.Sprintf("user %d redeemed subscription code (plan: %s, action: %s)", userId, planTitle, action))
	return planTitle, nil
}

// renewUserSubscriptionTx 续期同套餐订阅：
//   - end_time 从当前 end_time 累加新一段时长（如已过期则从 now 起）
//   - amount_total += plan.TotalAmount（不重置 amount_used，让 reset task 按周期处理）
//   - 限制快照覆盖为最新 plan 的值
func renewUserSubscriptionTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan) error {
	now := time.Unix(GetDBTimestamp(), 0)
	var base time.Time
	if sub.EndTime > now.Unix() {
		base = time.Unix(sub.EndTime, 0)
	} else {
		base = now
	}
	newEnd, err := calcPlanEndTime(base, plan)
	if err != nil {
		return err
	}
	updates := map[string]interface{}{
		"end_time":         newEnd,
		"amount_total":     sub.AmountTotal + plan.TotalAmount,
		"allowed_groups":   plan.AllowedGroups,
		"allowed_models":   plan.AllowedModels,
		"concurrent_limit": plan.ConcurrentLimit,
		"rpm_limit":        plan.RPMLimit,
		"updated_at":       common.GetTimestamp(),
	}
	// 如果套餐有 reset 周期，重新计算下次重置时间
	nextReset := calcNextResetTime(now, plan, newEnd)
	if nextReset > 0 {
		updates["next_reset_time"] = nextReset
	}
	return tx.Model(&UserSubscription{}).Where("id = ?", sub.Id).Updates(updates).Error
}

// cancelUserSubscriptionTx 标记订阅为 cancelled
func cancelUserSubscriptionTx(tx *gorm.DB, sub *UserSubscription) error {
	updates := map[string]interface{}{
		"status":     "cancelled",
		"updated_at": common.GetTimestamp(),
	}
	return tx.Model(&UserSubscription{}).Where("id = ?", sub.Id).Updates(updates).Error
}
