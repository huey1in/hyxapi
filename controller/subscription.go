package controller

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ---- Shared types ----

type SubscriptionPlanDTO struct {
	Plan model.SubscriptionPlan `json:"plan"`
}

// ---- User APIs ----

func GetSubscriptionSelf(c *gin.Context) {
	userId := c.GetInt("id")
	settingMap, _ := model.GetUserSetting(userId, false)
	pref := common.NormalizeBillingPreference(settingMap.BillingPreference)

	// Get all subscriptions (including expired)
	allSubscriptions, err := model.GetAllUserSubscriptions(userId)
	if err != nil {
		allSubscriptions = []model.SubscriptionSummary{}
	}

	// Get active subscriptions for backward compatibility
	activeSubscriptions, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil {
		activeSubscriptions = []model.SubscriptionSummary{}
	}

	common.ApiSuccess(c, gin.H{
		"billing_preference": pref,
		"subscriptions":      activeSubscriptions, // all active subscriptions
		"all_subscriptions":  allSubscriptions,    // all subscriptions including expired
	})
}

// ---- Admin APIs ----

func AdminListSubscriptionPlans(c *gin.Context) {
	var plans []model.SubscriptionPlan
	if err := model.DB.Order("sort_order desc, id desc").Limit(200).Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]SubscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		p.NormalizeDefaults()
		result = append(result, SubscriptionPlanDTO{
			Plan: p,
		})
	}
	common.ApiSuccess(c, result)
}

type AdminUpsertSubscriptionPlanRequest struct {
	Plan model.SubscriptionPlan `json:"plan"`
}

func AdminCreateSubscriptionPlan(c *gin.Context) {
	var req AdminUpsertSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.Plan.Id = 0
	if strings.TrimSpace(req.Plan.Title) == "" {
		common.ApiErrorMsg(c, "套餐标题不能为空")
		return
	}
	if req.Plan.DurationUnit == "" {
		req.Plan.DurationUnit = model.SubscriptionDurationMonth
	}
	if req.Plan.DurationValue <= 0 && req.Plan.DurationUnit != model.SubscriptionDurationCustom {
		req.Plan.DurationValue = 1
	}
	if req.Plan.TotalAmount < 0 {
		common.ApiErrorMsg(c, "总额度不能为负数")
		return
	}
	if req.Plan.ConcurrentLimit < 0 {
		common.ApiErrorMsg(c, "并发限制不能为负数")
		return
	}
	if req.Plan.RPMLimit < 0 {
		common.ApiErrorMsg(c, "RPM 限制不能为负数")
		return
	}
	if err := validateSubscriptionPurchaseFields(&req.Plan); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Plan.QuotaResetPeriod = model.NormalizeResetPeriod(req.Plan.QuotaResetPeriod)
	if req.Plan.QuotaResetPeriod == model.SubscriptionResetCustom && req.Plan.QuotaResetCustomSeconds <= 0 {
		common.ApiErrorMsg(c, "自定义重置周期需大于0秒")
		return
	}
	err := model.DB.Create(&req.Plan).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(req.Plan.Id)
	model.RecordLegacyAuditLog(c, model.AuditCreate, "subscription", req.Plan.Id, fmt.Sprintf("创建订阅套餐 [%s]", req.Plan.Title))
	common.ApiSuccess(c, req.Plan)
}

func AdminUpdateSubscriptionPlan(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	var req AdminUpsertSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if strings.TrimSpace(req.Plan.Title) == "" {
		common.ApiErrorMsg(c, "套餐标题不能为空")
		return
	}
	req.Plan.Id = id
	if req.Plan.DurationUnit == "" {
		req.Plan.DurationUnit = model.SubscriptionDurationMonth
	}
	if req.Plan.DurationValue <= 0 && req.Plan.DurationUnit != model.SubscriptionDurationCustom {
		req.Plan.DurationValue = 1
	}
	if req.Plan.TotalAmount < 0 {
		common.ApiErrorMsg(c, "总额度不能为负数")
		return
	}
	if req.Plan.ConcurrentLimit < 0 {
		common.ApiErrorMsg(c, "并发限制不能为负数")
		return
	}
	if req.Plan.RPMLimit < 0 {
		common.ApiErrorMsg(c, "RPM 限制不能为负数")
		return
	}
	if err := validateSubscriptionPurchaseFields(&req.Plan); err != nil {
		common.ApiError(c, err)
		return
	}
	req.Plan.QuotaResetPeriod = model.NormalizeResetPeriod(req.Plan.QuotaResetPeriod)
	if req.Plan.QuotaResetPeriod == model.SubscriptionResetCustom && req.Plan.QuotaResetCustomSeconds <= 0 {
		common.ApiErrorMsg(c, "自定义重置周期需大于0秒")
		return
	}

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		// update plan (allow zero values updates with map)
		updateMap := map[string]interface{}{
			"price_amount": req.Plan.PriceAmount, "currency": req.Plan.Currency,
			"allow_balance_pay": req.Plan.AllowBalancePay, "allow_wallet_overflow": req.Plan.AllowWalletOverflow,
			"stripe_price_id": req.Plan.StripePriceId, "creem_product_id": req.Plan.CreemProductId, "waffo_pancake_product_id": req.Plan.WaffoPancakeProductId,
			"max_purchase_per_user": req.Plan.MaxPurchasePerUser, "upgrade_group": req.Plan.UpgradeGroup, "downgrade_group": req.Plan.DowngradeGroup,
			"title":                      req.Plan.Title,
			"subtitle":                   req.Plan.Subtitle,
			"duration_unit":              req.Plan.DurationUnit,
			"duration_value":             req.Plan.DurationValue,
			"custom_seconds":             req.Plan.CustomSeconds,
			"enabled":                    req.Plan.Enabled,
			"sort_order":                 req.Plan.SortOrder,
			"total_amount":               req.Plan.TotalAmount,
			"quota_reset_period":         req.Plan.QuotaResetPeriod,
			"quota_reset_custom_seconds": req.Plan.QuotaResetCustomSeconds,
			"allowed_groups":             req.Plan.AllowedGroups,
			"allowed_models":             req.Plan.AllowedModels,
			"concurrent_limit":           req.Plan.ConcurrentLimit,
			"rpm_limit":                  req.Plan.RPMLimit,
			"updated_at":                 common.GetTimestamp(),
		}
		if err := tx.Model(&model.SubscriptionPlan{}).Where("id = ?", id).Updates(updateMap).Error; err != nil {
			return err
		}
		// 同步更新所有活跃订阅的限制快照
		subUpdates := map[string]interface{}{
			"allowed_groups":   req.Plan.AllowedGroups,
			"allowed_models":   req.Plan.AllowedModels,
			"concurrent_limit": req.Plan.ConcurrentLimit,
			"rpm_limit":        req.Plan.RPMLimit,
			"updated_at":       common.GetTimestamp(),
		}
		if err := tx.Model(&model.UserSubscription{}).
			Where("plan_id = ? AND status = ?", id, "active").
			Updates(subUpdates).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(id)
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "subscription", id, fmt.Sprintf("更新订阅套餐 #%d [%s]", id, req.Plan.Title))
	common.ApiSuccess(c, nil)
}

type AdminUpdateSubscriptionPlanStatusRequest struct {
	Enabled *bool `json:"enabled"`
}

func AdminUpdateSubscriptionPlanStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	var req AdminUpdateSubscriptionPlanStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Enabled == nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", id).Update("enabled", *req.Enabled).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(id)
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "subscription", id, fmt.Sprintf("更新套餐状态 #%d, enabled=%v", id, *req.Enabled))
	common.ApiSuccess(c, nil)
}

// AdminDeleteSubscriptionPlan 删除订阅套餐（含未使用的兑换码）。
// 已被用户激活的 UserSubscription 历史记录保留（仅外键引用 plan_id，可孤立）。
func AdminDeleteSubscriptionPlan(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		// 删除该套餐下所有未使用的兑换码（已使用的保留作为审计）
		if err := tx.Where("plan_id = ? AND status = ?", id, model.SubscriptionRedemptionStatusEnabled).
			Delete(&model.SubscriptionRedemption{}).Error; err != nil {
			return err
		}
		// 删除套餐本身
		if err := tx.Where("id = ?", id).Delete(&model.SubscriptionPlan{}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(id)
	model.RecordLegacyAuditLog(c, model.AuditDelete, "subscription", id, fmt.Sprintf("删除订阅套餐 #%d", id))
	common.ApiSuccess(c, nil)
}

type AdminBindSubscriptionRequest struct {
	UserId int `json:"user_id"`
	PlanId int `json:"plan_id"`
}

func AdminBindSubscription(c *gin.Context) {
	var req AdminBindSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.UserId <= 0 || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	msg, err := model.AdminBindSubscription(req.UserId, req.PlanId, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditCreate, "subscription", req.PlanId, fmt.Sprintf("为用户 #%d 绑定套餐 #%d", req.UserId, req.PlanId))
	if msg != nil {
		common.ApiSuccessT(c, msg.Key, nil, msg.Params)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---- Admin: user subscription management ----

func AdminListUserSubscriptions(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}
	subs, err := model.GetAllUserSubscriptions(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subs)
}

type AdminCreateUserSubscriptionRequest struct {
	PlanId int `json:"plan_id"`
}

// AdminCreateUserSubscription creates a new user subscription from a plan (no payment).
func AdminCreateUserSubscription(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}
	var req AdminCreateUserSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	msg, err := model.AdminBindSubscription(userId, req.PlanId, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditCreate, "user_subscription", userId, fmt.Sprintf("为用户 #%d 创建订阅，套餐 #%d", userId, req.PlanId))
	if msg != nil {
		common.ApiSuccessT(c, msg.Key, nil, msg.Params)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminInvalidateUserSubscription cancels a user subscription immediately.
func AdminInvalidateUserSubscription(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := model.AdminInvalidateUserSubscription(subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditDisable, "user_subscription", subId, fmt.Sprintf("作废用户订阅 #%d", subId))
	if msg != nil {
		common.ApiSuccessT(c, msg.Key, nil, msg.Params)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeleteUserSubscription hard-deletes a user subscription.
func AdminDeleteUserSubscription(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := model.AdminDeleteUserSubscription(subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditDelete, "user_subscription", subId, fmt.Sprintf("删除用户订阅 #%d", subId))
	if msg != nil {
		common.ApiSuccessT(c, msg.Key, nil, msg.Params)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---- Subscription redemption codes ----

type GenerateSubscriptionCodesRequest struct {
	Count       int   `json:"count"`
	ExpiredTime int64 `json:"expired_time"`
}

// AdminGenerateSubscriptionCodes generates N redemption codes for a plan.
func AdminGenerateSubscriptionCodes(c *gin.Context) {
	planId, _ := strconv.Atoi(c.Param("id"))
	if planId <= 0 {
		common.ApiErrorMsg(c, "无效的套餐ID")
		return
	}
	var req GenerateSubscriptionCodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Count <= 0 {
		req.Count = 1
	}
	codes, err := model.GenerateSubscriptionCodes(planId, req.Count, req.ExpiredTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, codes)
}

// AdminListSubscriptionCodes lists all codes for a plan.
func AdminListSubscriptionCodes(c *gin.Context) {
	planId, _ := strconv.Atoi(c.Param("id"))
	if planId <= 0 {
		common.ApiErrorMsg(c, "无效的套餐ID")
		return
	}
	keyword := c.Query("keyword")
	codes, err := model.ListSubscriptionCodesByPlan(planId, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, codes)
}

// AdminDeleteSubscriptionCode removes a single code by id.
func AdminDeleteSubscriptionCode(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的兑换码ID")
		return
	}
	if err := model.DeleteSubscriptionCodeById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeleteInvalidSubscriptionCodes removes used/expired codes for a plan.
func AdminDeleteInvalidSubscriptionCodes(c *gin.Context) {
	planId, _ := strconv.Atoi(c.Query("plan_id"))
	if planId <= 0 {
		common.ApiErrorMsg(c, "无效的套餐ID")
		return
	}
	affected, err := model.DeleteInvalidSubscriptionCodes(planId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, fmt.Sprintf("已清理 %d 个失效激活码", affected))
}

type RedeemSubscriptionCodeRequest struct {
	Key string `json:"key"`
}

// UserRedeemSubscriptionCode lets the current user redeem a code.
func UserRedeemSubscriptionCode(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}
	var req RedeemSubscriptionCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	planTitle, err := model.RedeemSubscriptionCode(req.Key, userId)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{"plan_title": planTitle})
}

func recordSubscriptionResetUserLogs(c *gin.Context, result *model.SubscriptionResetResult, adminInfo *model.AuditAdminInfo) {
	if result == nil || result.ResetCount == 0 {
		return
	}
	const action = "subscription.user_quota_reset"
	params := map[string]any{"plan_id": result.PlanId, "plan_title": result.PlanTitle}
	operation := model.AuditOperation{Action: action, Params: params}
	content := auditContentEN(action, params)
	for _, userId := range result.AffectedUserIds {
		model.RecordLogWithAdminInfo(userId, model.LogTypeManage, content, adminInfo, &operation, c)
	}
}

func GetSubscriptionPlans(c *gin.Context) {
	var plans []model.SubscriptionPlan
	if err := model.DB.Where("enabled = ?", true).Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]SubscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		p.NormalizeDefaults()
		result = append(result, SubscriptionPlanDTO{
			Plan: p,
		})
	}
	common.ApiSuccess(c, result)
}

func UpdateSubscriptionPreference(c *gin.Context) {
	userId := c.GetInt("id")
	var req BillingPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	pref := common.NormalizeBillingPreference(req.BillingPreference)

	err := model.PatchUserSetting(c.Request.Context(), userId, func(current dto.UserSetting, role int) (dto.UserSetting, error) {
		current.BillingPreference = pref
		return current, nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"billing_preference": pref})
}

func SubscriptionRequestBalancePay(c *gin.Context) {
	userId := c.GetInt("id")
	var req SubscriptionBalancePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	if err := model.PurchaseSubscriptionWithBalance(userId, req.PlanId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func resolveAdvanceResetTime(value *bool) bool {
	if value == nil {
		return true
	}
	return *value
}

func AdminResetUserSubscriptionsByPlan(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorT(c, "Invalid user ID")
		return
	}
	var req AdminResetSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if req.PlanId <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	advanceResetTime := resolveAdvanceResetTime(req.AdvanceResetTime)
	result, err := model.AdminResetUserSubscriptionsByPlan(userId, req.PlanId, advanceResetTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordSubscriptionResetUserLogs(c, result, auditOperatorInfo(c))
	recordManageAuditFor(c, userId, "subscription.user_plan_reset", map[string]any{
		"target_user_id":     userId,
		"plan_id":            result.PlanId,
		"plan_title":         result.PlanTitle,
		"reset_count":        result.ResetCount,
		"user_count":         result.UserCount,
		"advance_reset_time": result.AdvanceResetTime,
	})
	common.ApiSuccess(c, result)
}

func AdminResetPlanSubscriptions(c *gin.Context) {
	planId, _ := strconv.Atoi(c.Param("id"))
	if planId <= 0 {
		common.ApiErrorT(c, "Invalid ID")
		return
	}
	var req AdminResetSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	advanceResetTime := resolveAdvanceResetTime(req.AdvanceResetTime)
	result, err := model.AdminResetPlanSubscriptions(planId, advanceResetTime)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordSubscriptionResetUserLogs(c, result, auditOperatorInfo(c))
	common.SysLog(fmt.Sprintf("admin reset subscription plan %d quota: reset_count=%d user_count=%d advance_reset_time=%t",
		result.PlanId, result.ResetCount, result.UserCount, result.AdvanceResetTime))
	recordManageAudit(c, "subscription.plan_reset", map[string]any{
		"plan_id":            result.PlanId,
		"plan_title":         result.PlanTitle,
		"reset_count":        result.ResetCount,
		"user_count":         result.UserCount,
		"advance_reset_time": result.AdvanceResetTime,
	})
	common.ApiSuccess(c, result)
}

type BillingPreferenceRequest struct {
	BillingPreference string `json:"billing_preference"`
}

type SubscriptionBalancePayRequest struct {
	PlanId int `json:"plan_id"`
}

type AdminResetSubscriptionRequest struct {
	PlanId           int   `json:"plan_id"`
	AdvanceResetTime *bool `json:"advance_reset_time"`
}

func validateSubscriptionPurchaseFields(plan *model.SubscriptionPlan) error {
	if math.IsNaN(plan.PriceAmount) || plan.PriceAmount < 0 || plan.PriceAmount > 9999 {
		return common.NewMessage("Price must be between 0 and 9999")
	}
	if math.Round(plan.PriceAmount*1e6)/1e6 != plan.PriceAmount {
		return common.NewMessage("Price must have at most 6 decimal places")
	}
	if plan.MaxPurchasePerUser < 0 {
		return common.NewMessage("Purchase limit cannot be negative")
	}
	plan.Currency = "USD"
	plan.NormalizeDefaults()
	plan.UpgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
	plan.DowngradeGroup = strings.TrimSpace(plan.DowngradeGroup)
	groups := ratio_setting.GetGroupRatioCopy()
	if plan.UpgradeGroup != "" {
		if _, ok := groups[plan.UpgradeGroup]; !ok {
			return common.NewMessage("Upgrade group does not exist")
		}
	}
	if plan.DowngradeGroup != "" {
		if _, ok := groups[plan.DowngradeGroup]; !ok {
			return common.NewMessage("Downgrade group does not exist")
		}
	}
	return nil
}
