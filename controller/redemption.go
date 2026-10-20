package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetAllRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.GetAllRedemptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
	return
}

func SearchRedemptions(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.SearchRedemptions(keyword, c.Query("status"), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    redemption,
	})
	return
}

func AddRedemption(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	redemption := model.Redemption{}
	err := c.ShouldBindJSON(&redemption)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if redemption.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionCountPositive)
		return
	}
	if redemption.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionCountMax)
		return
	}
	redemption.Name = strings.TrimSpace(redemption.Name)
	if utf8.RuneCountInString(redemption.Name) > 20 {
		common.ApiErrorT(c, "Redemption code name length must be between 1-20")
		return
	}
	if redemption.Quota <= 0 {
		common.ApiErrorT(c, "Redemption quota must be positive")
		return
	}
	if err := common.ValidateWalletQuota(redemption.Quota); err != nil {
		common.ApiError(c, err)
		return
	}
	if valid, msg := validateExpiredTime(c, redemption.ExpiredTime); !valid {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}
	var keys []string
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < redemption.Count; i++ {
			key := common.GenerateRedeemCode()
			cleanRedemption := model.Redemption{
				UserId:      c.GetInt("id"),
				Name:        redemption.Name,
				Key:         key,
				CreatedTime: common.GetTimestamp(),
				Quota:       redemption.Quota,
				ExpiredTime: redemption.ExpiredTime,
			}
			if err := tx.Create(&cleanRedemption).Error; err != nil {
				return err
			}
			keys = append(keys, key)
		}
		return nil
	})
	if err != nil {
		common.SysError("failed to insert redemption batch: " + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgRedemptionCreateFailed),
		})
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditCreate, "redemption", 0, fmt.Sprintf("创建兑换码，共 %d 个", len(keys)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
	return
}

func DeleteRedemption(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	err := model.DeleteRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditDelete, "redemption", id, fmt.Sprintf("删除兑换码 #%d", id))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func UpdateRedemption(c *gin.Context) {
	statusOnly := c.Query("status_only")
	redemption := model.Redemption{}
	err := c.ShouldBindJSON(&redemption)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cleanRedemption, err := model.GetRedemptionById(redemption.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	expectedStatus := cleanRedemption.Status
	if statusOnly == "" {
		if valid, msg := validateExpiredTime(c, redemption.ExpiredTime); !valid {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
			return
		}
		redemption.Name = strings.TrimSpace(redemption.Name)
		if utf8.RuneCountInString(redemption.Name) > 20 {
			common.ApiErrorT(c, "Redemption code name length must be between 1-20")
			return
		}
		// If you add more fields, please also update redemption.Update()
		cleanRedemption.Name = redemption.Name
		cleanRedemption.Quota = redemption.Quota
		cleanRedemption.ExpiredTime = redemption.ExpiredTime
	}
	if statusOnly != "" {
		if redemption.Status != common.RedemptionCodeStatusEnabled && redemption.Status != common.RedemptionCodeStatusDisabled {
			common.ApiErrorT(c, "Invalid parameters")
			return
		}
		if cleanRedemption.Status == common.RedemptionCodeStatusUsed {
			common.ApiErrorT(c, "Redemption code already used")
			return
		}
		cleanRedemption.Status = redemption.Status
	}
	err = cleanRedemption.UpdateIfStatus(expectedStatus)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "redemption", cleanRedemption.Id, fmt.Sprintf("更新兑换码 #%d", cleanRedemption.Id))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanRedemption,
	})
	return
}

func DeleteInvalidRedemption(c *gin.Context) {
	rows, err := model.DeleteInvalidRedemptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditDelete, "redemption", 0, fmt.Sprintf("删除无效兑换码，共 %d 个", rows))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

func validateExpiredTime(c *gin.Context, expired int64) (bool, string) {
	if expired != 0 && expired < common.GetTimestamp() {
		return false, i18n.T(c, i18n.MsgRedemptionExpireTimeInvalid)
	}
	return true, ""
}

func DeleteRedemptionBatch(c *gin.Context) {
	var request struct {
		IDs []int `json:"ids" binding:"required,min=1,max=1000,dive,gt=0"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	count, err := model.BatchDeleteRedemptions(request.IDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditDelete, "redemption", 0, fmt.Sprintf("删除兑换码，共 %d 个，请求 ID %v", count, request.IDs))
	common.ApiSuccess(c, count)
}
