package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func GetOptions(c *gin.Context) {
	var options []*model.Option
	emailTemplateKeys := map[string]bool{
		common.EmailTemplateVerificationKey:  false,
		common.EmailTemplatePasswordResetKey: false,
	}
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		if model.IsRemovedModelPricingOption(k) {
			continue
		}
		value := common.Interface2String(v)
		if k == "billing_setting.billing_mode" {
			encoded, _ := common.Marshal(billing_setting.GetBillingModeCopy())
			value = string(encoded)
		} else if k == "billing_setting.billing_expr" {
			encoded, _ := common.Marshal(billing_setting.GetBillingExprCopy())
			value = string(encoded)
		}
		if (k == common.EmailTemplateVerificationKey || k == common.EmailTemplatePasswordResetKey) && strings.TrimSpace(value) == "" {
			value = common.GetEmailTemplate(k)
		}
		if _, ok := emailTemplateKeys[k]; ok {
			emailTemplateKeys[k] = true
		}
		isSensitiveKey := strings.HasSuffix(k, "Token") ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "secret") ||
			strings.HasSuffix(k, "api_key")
		if isSensitiveKey {
			continue
		}
		options = append(options, &model.Option{
			Key:   k,
			Value: value,
		})
	}
	for key, found := range emailTemplateKeys {
		if !found {
			options = append(options, &model.Option{
				Key:   key,
				Value: common.GetEmailTemplate(key),
			})
		}
	}
	common.OptionMapRWMutex.Unlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
	return
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

func UpdateOption(c *gin.Context) {
	var option OptionUpdateRequest
	err := common.DecodeJson(c.Request.Body, &option)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	switch option.Value.(type) {
	case bool:
		option.Value = common.Interface2String(option.Value.(bool))
	case float64:
		option.Value = common.Interface2String(option.Value.(float64))
	case int:
		option.Value = common.Interface2String(option.Value.(int))
	default:
		option.Value = fmt.Sprintf("%v", option.Value)
	}
	if err := validatePaymentOption(option.Key, option.Value.(string)); err != nil {
		common.ApiError(c, err)
		return
	}
	switch option.Key {
	case "log_setting.max_range_days":
		days, parseErr := strconv.Atoi(option.Value.(string))
		if parseErr != nil || days < 1 || days > 36500 {
			common.ApiErrorMsg(c, "Log range must be between 1 and 36500 days")
			return
		}

	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})

			return
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && !system_setting.GetTelegramSettings().IsConfigured() {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "启用 Telegram 登录前，请填写 Telegram Client ID 和 Client Secret。",
			})
			return
		}
	case "AlipayEnabled":
		if option.Value == "true" && (strings.TrimSpace(operation_setting.AlipayAppId) == "" || strings.TrimSpace(operation_setting.AlipayPrivateKey) == "" || strings.TrimSpace(operation_setting.AlipayPublicKey) == "" || strings.TrimSpace(operation_setting.AlipayGateway) == "") {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "启用支付宝前请先填写 App ID、应用私钥、支付宝公钥和网关地址"})
			return
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticDisableStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticRetryStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		if model.IsPasskeyDomainOption(option.Key) {
			writePasskeyDomainSettingsError(c, err)
		} else {
			common.ApiError(c, err)
		}
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "setting", 0, fmt.Sprintf("更新系统设置 [%s]", option.Key))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func SendTestEmail(c *gin.Context) {
	var req struct {
		Email string `json:"email"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.Email == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请输入有效的邮箱地址",
		})
		return
	}
	if common.SMTPServer == "" || common.SMTPAccount == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请先配置 SMTP 服务器和账号",
		})
		return
	}
	subject, content := common.RenderTestEmail()
	err := common.SendEmail(subject, req.Email, content)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("发送失败：%s", err.Error()),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "测试邮件已发送",
	})
}

func UpdatePasskeyDomains(c *gin.Context) {
	var request struct {
		RPID                *string `json:"rp_id"`
		LegacyRPIDs         *string `json:"legacy_rp_ids"`
		Origins             *string `json:"origins"`
		ServerAddress       *string `json:"server_address"`
		Preview             bool    `json:"preview"`
		RemovalConfirmation string  `json:"removal_confirmation"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || request.RPID == nil || request.LegacyRPIDs == nil || request.Origins == nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	values := map[string]string{
		"passkey.rp_id": *request.RPID, "passkey.legacy_rp_ids": *request.LegacyRPIDs, "passkey.origins": *request.Origins,
	}
	if request.ServerAddress != nil {
		values["ServerAddress"] = *request.ServerAddress
	}
	change, err := model.UpdatePasskeyDomainOptions(values, request.Preview, request.RemovalConfirmation)
	if err != nil {
		writePasskeyDomainSettingsError(c, err)
		if !request.Preview {
			recordPasskeyDomainAudit(c, change, request.RemovalConfirmation != "", err)
		}
		return
	}
	if !request.Preview {
		recordPasskeyDomainAudit(c, change, request.RemovalConfirmation != "", nil)
	}
	common.ApiSuccess(c, change)
}

func writePasskeyDomainSettingsError(c *gin.Context, err error) {
	var removal *model.PasskeyDomainRemovalError
	if errors.As(err, &removal) {
		common.ApiErrorStatus(c, http.StatusConflict, common.NewMessage("Review the affected Passkeys and confirm the domain removal. If the settings or impact have changed, confirmation is required again."), gin.H{
			"code": "PASSKEY_RP_ID_REMOVAL_CONFIRMATION_REQUIRED",
			"data": removal.Change,
		})
		return
	}
	if errors.Is(err, system_setting.ErrPasskeyRPIDInvalid) {
		writeSecurityOperationError(c, err)
		return
	}
	common.ApiError(c, err)
}
