package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type tokenResponse struct {
	*model.Token
	AutoGroups []string `json:"auto_groups"`
}

func buildMaskedTokenResponse(token *model.Token) *tokenResponse {
	if token == nil {
		return nil
	}
	maskedToken := *token
	maskedToken.NormalizeGroupPolicy()
	maskedToken.Key = token.GetMaskedKey()
	groups, err := token.GetAutoGroups()
	if err != nil {
		common.SysError(fmt.Sprintf("failed to parse auto groups for token %d: %v", token.Id, err))
	}
	if len(groups) == 0 {
		groups = nil
	}
	return &tokenResponse{Token: &maskedToken, AutoGroups: groups}
}

func buildMaskedTokenResponses(tokens []*model.Token) []*tokenResponse {
	maskedTokens := make([]*tokenResponse, 0, len(tokens))
	for _, token := range tokens {
		maskedTokens = append(maskedTokens, buildMaskedTokenResponse(token))
	}
	return maskedTokens
}

func GetAllTokens(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	tokens, err := model.GetUserTokenList(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, err := model.CountUserTokens(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tokens)
	common.ApiSuccess(c, pageInfo)
}

func SearchTokens(c *gin.Context) {
	userId := c.GetInt("id")
	keyword := c.Query("keyword")
	token := c.Query("token")

	pageInfo := common.GetPageQuery(c)

	tokens, total, err := model.SearchUserTokens(userId, keyword, token, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	common.ApiSuccess(c, pageInfo)
}

func GetToken(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token, err := model.GetTokenByIds(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildMaskedTokenResponse(token))
}

func GetTokenKey(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token, err := model.GetTokenByIds(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"key": token.GetFullKey(),
	})
}

// GetTokenModels uses the relay's discovery policy without authenticating with the
// API key, so configuring a client does not count as a use of that key.
func GetTokenModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token, err := model.GetTokenByIds(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user, err := model.GetUserCache(token.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token.NormalizeGroupPolicy()
	if len(token.Groups) > 0 && token.Groups[0] != "auto" && !service.IsUserSelectableGroup(user.Group, token.Groups[0]) {
		common.ApiSuccess(c, []any{})
		return
	}
	user.WriteContext(c)
	if err := middleware.SetupContextForToken(c, token); err != nil {
		return
	}
	ListModels(c, constant.ChannelTypeOpenAI)
}

func GetTokenUsage(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "No Authorization header",
		})
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid Bearer token",
		})
		return
	}
	tokenKey := parts[1]

	token, err := model.GetTokenByKey(strings.TrimPrefix(tokenKey, "sk-"), false)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to get token by key: %s", err.Error()))
		common.ApiErrorI18n(c, i18n.MsgTokenGetInfoFailed)
		return
	}

	expiredAt := token.ExpiredTime
	if expiredAt == -1 {
		expiredAt = 0
	}

	data := gin.H{
		"object":               "token_usage",
		"name":                 token.Name,
		"total_granted":        token.RemainQuota + token.UsedQuota,
		"total_used":           token.UsedQuota,
		"total_available":      token.RemainQuota,
		"unlimited_quota":      token.UnlimitedQuota,
		"model_limits":         token.GetModelLimitsMap(),
		"model_limits_enabled": token.ModelLimitsEnabled,
		"expires_at":           expiredAt,
	}
	// 用户额度只在令牌允许时返回；IP 白名单已由 TokenAuthReadOnly 检查。
	if token.AllowUserQuotaQuery {
		userQuota, err := model.GetUserQuota(token.UserId, false)
		var userUsedQuota int
		if err == nil {
			userUsedQuota, err = model.GetUserUsedQuota(token.UserId)
		}
		if err != nil {
			common.SysError(fmt.Sprintf("failed to get user quota: %s", err.Error()))
			common.ApiErrorI18n(c, i18n.MsgTokenGetInfoFailed)
			return
		}
		data["user_quota"] = gin.H{
			"total_available": userQuota,
			"total_used":      userUsedQuota,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    true,
		"message": "ok",
		"data":    data,
	})
}

type tokenAutoGroupsInput struct {
	Set    bool
	Groups []string
}

func (input *tokenAutoGroupsInput) UnmarshalJSON(data []byte) error {
	input.Set = true
	return common.Unmarshal(data, &input.Groups)
}

type tokenQuotaRequest struct {
	model.Token
	AutoGroups          tokenAutoGroupsInput `json:"auto_groups"`
	AllowUserQuotaQuery *bool                `json:"allow_user_quota_query"`
}

func getTokenRequestUserGroup(c *gin.Context) (string, error) {
	if group := common.GetContextKeyString(c, constant.ContextKeyUserGroup); group != "" {
		return group, nil
	}
	if group := c.GetString("group"); group != "" {
		return group, nil
	}
	return model.GetUserGroup(c.GetInt("id"), false)
}

func GetTokenAutoGroups(c *gin.Context) {
	group, err := getTokenRequestUserGroup(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"groups":    service.GetUserAutoGroup(group),
		"max_count": setting.GetMaxTokenAutoGroups(),
	})
}

func setTokenAutoGroups(c *gin.Context, token *model.Token, groups []string) bool {
	if len(groups) > setting.GetMaxTokenAutoGroups() {
		common.ApiErrorT(c, "A token can select at most {{max}} Auto groups", map[string]any{"max": setting.GetMaxTokenAutoGroups()})
		return false
	}
	if len(groups) > 0 {
		userGroup, err := getTokenRequestUserGroup(c)
		if err != nil {
			common.ApiError(c, err)
			return false
		}
		seen := make(map[string]struct{}, len(groups))
		for _, group := range groups {
			if _, ok := seen[group]; ok {
				common.ApiErrorT(c, "Auto group {{group}} is duplicated", map[string]any{"group": group})
				return false
			}
			seen[group] = struct{}{}
			if !service.IsUserSelectableGroup(userGroup, group) {
				common.ApiErrorT(c, "Auto group {{group}} is unavailable or unauthorized", map[string]any{"group": group})
				return false
			}
		}
	}
	if err := token.SetAutoGroups(groups); err != nil {
		common.ApiError(c, err)
		return false
	}
	return true
}

func AddToken(c *gin.Context) {
	request := tokenQuotaRequest{}
	err := c.ShouldBindJSON(&request)
	token := request.Token
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	// 非无限额度时，检查额度值是否超出有效范围
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	// 检查用户令牌数量是否已达上限
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if int(count) >= maxTokens {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens),
		})
		return
	}
	if token.Group == "" && token.Groups == nil {
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
			token.CrossGroupRetry = true
		} else {
			userGroup, err := getTokenRequestUserGroup(c)
			if err != nil {
				common.ApiError(c, err)
				return
			}
			groups := service.GetUserSelectableGroups(userGroup)
			if len(groups) == 0 {
				common.ApiErrorT(c, "No groups are available")
				return
			}
			token.Group = groups[0]
		}
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		common.SysLog("failed to generate token key: " + err.Error())
		return
	}
	cleanToken := model.Token{
		UserId:                c.GetInt("id"),
		Name:                  token.Name,
		Key:                   key,
		CreatedTime:           common.GetTimestamp(),
		ExpiredTime:           token.ExpiredTime,
		RemainQuota:           token.RemainQuota,
		UnlimitedQuota:        token.UnlimitedQuota,
		ModelLimitsEnabled:    token.ModelLimitsEnabled,
		ModelLimits:           token.ModelLimits,
		AllowIps:              token.AllowIps,
		Group:                 token.Group,
		CrossGroupRetry:       token.CrossGroupRetry,
		Groups:                token.Groups,
		GroupSwitchCodes:      token.GroupSwitchCodes,
		GroupSwitchRetryCount: token.GroupSwitchRetryCount,
	}
	cleanToken.AllowUserQuotaQuery = request.AllowUserQuotaQuery == nil || *request.AllowUserQuotaQuery
	cleanToken.NormalizeGroupPolicy()
	if cleanToken.UsesAutoGroups() && !setTokenAutoGroups(c, &cleanToken, request.AutoGroups.Groups) {
		return
	}
	err = cleanToken.Insert()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func DeleteToken(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	err := model.DeleteTokenById(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func UpdateToken(c *gin.Context) {
	userId := c.GetInt("id")
	statusOnly := c.Query("status_only")
	request := tokenQuotaRequest{}
	err := c.ShouldBindJSON(&request)
	token := request.Token
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly != "" {
		updated, err := model.SetUserTokenStatus(c.Request.Context(), userId, token.Id, token.Status)
		switch {
		case errors.Is(err, model.ErrTokenStatusExpired):
			common.ApiErrorI18n(c, i18n.MsgTokenExpiredCannotEnable)
		case errors.Is(err, model.ErrTokenStatusExhausted):
			common.ApiErrorI18n(c, i18n.MsgTokenExhaustedCannotEable)
		case err != nil:
			common.ApiError(c, err)
		default:
			common.ApiSuccess(c, buildMaskedTokenResponse(updated))
		}
		return
	}
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int((1000000000 * common.QuotaPerUnit))
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	cleanToken, err := model.GetTokenByIds(token.Id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if token.Status == common.TokenStatusEnabled {
		if cleanToken.Status == common.TokenStatusExpired && cleanToken.ExpiredTime <= common.GetTimestamp() && cleanToken.ExpiredTime != -1 {
			common.ApiErrorI18n(c, i18n.MsgTokenExpiredCannotEnable)
			return
		}
		if cleanToken.Status == common.TokenStatusExhausted && cleanToken.RemainQuota <= 0 && !cleanToken.UnlimitedQuota {
			common.ApiErrorI18n(c, i18n.MsgTokenExhaustedCannotEable)
			return
		}
	}
	// If you add more fields, please also update token.Update()
	cleanToken.Name = token.Name
	cleanToken.ExpiredTime = token.ExpiredTime
	cleanToken.RemainQuota = token.RemainQuota
	cleanToken.UnlimitedQuota = token.UnlimitedQuota
	cleanToken.ModelLimitsEnabled = token.ModelLimitsEnabled
	cleanToken.ModelLimits = token.ModelLimits
	cleanToken.AllowIps = token.AllowIps
	if request.AllowUserQuotaQuery != nil {
		cleanToken.AllowUserQuotaQuery = *request.AllowUserQuotaQuery
	}
	if token.Group != "" || token.Groups != nil {
		cleanToken.Group = token.Group
		cleanToken.CrossGroupRetry = token.CrossGroupRetry
		cleanToken.Groups = token.Groups
		cleanToken.GroupSwitchCodes = token.GroupSwitchCodes
		cleanToken.GroupSwitchRetryCount = token.GroupSwitchRetryCount
	}
	cleanToken.NormalizeGroupPolicy()
	if !cleanToken.UsesAutoGroups() {
		_ = cleanToken.SetAutoGroups(nil)
	} else if request.AutoGroups.Set && !setTokenAutoGroups(c, cleanToken, request.AutoGroups.Groups) {
		return
	}
	err = cleanToken.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    buildMaskedTokenResponse(cleanToken),
	})
}

type TokenBatch struct {
	Ids []int `json:"ids"`
}

func DeleteTokenBatch(c *gin.Context) {
	tokenBatch := TokenBatch{}
	if err := c.ShouldBindJSON(&tokenBatch); err != nil || len(tokenBatch.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(tokenBatch.Ids) > 1000 {
		common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": 1000})
		return
	}
	for _, id := range tokenBatch.Ids {
		if id <= 0 {
			common.ApiErrorI18n(c, i18n.MsgInvalidParams)
			return
		}
	}
	userId := c.GetInt("id")
	count, err := model.BatchDeleteTokens(tokenBatch.Ids, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
}

func GetTokenKeysBatch(c *gin.Context) {
	tokenBatch := TokenBatch{}
	if err := c.ShouldBindJSON(&tokenBatch); err != nil || len(tokenBatch.Ids) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(tokenBatch.Ids) > 100 {
		common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": 100})
		return
	}
	userId := c.GetInt("id")
	tokens, err := model.GetTokenKeysByIds(tokenBatch.Ids, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	keysMap := make(map[int]string)
	for _, t := range tokens {
		keysMap[t.Id] = t.GetFullKey()
	}
	common.ApiSuccess(c, gin.H{"keys": keysMap})
}
