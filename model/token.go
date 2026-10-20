package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

type Token struct {
	AutoGroups             string         `json:"-" gorm:"type:text"`
	AllowUserQuotaQuery    bool           `json:"allow_user_quota_query" gorm:"not null;default:false"`
	Id                     int            `json:"id"`
	UserId                 int            `json:"user_id" gorm:"index"`
	Key                    string         `json:"key" gorm:"type:char(48);uniqueIndex"`
	Status                 int            `json:"status" gorm:"default:1"`
	Name                   string         `json:"name" gorm:"index" `
	CreatedTime            int64          `json:"created_time" gorm:"bigint"`
	AccessedTime           int64          `json:"accessed_time" gorm:"bigint"`
	ExpiredTime            int64          `json:"expired_time" gorm:"bigint;default:-1"` // -1 means never expired
	RemainQuota            int            `json:"remain_quota" gorm:"default:0"`
	UnlimitedQuota         bool           `json:"unlimited_quota"`
	ModelLimitsEnabled     bool           `json:"model_limits_enabled"`
	ModelLimits            string         `json:"model_limits" gorm:"type:text"`
	AllowIps               *string        `json:"allow_ips" gorm:"default:''"`
	UsedQuota              int            `json:"used_quota" gorm:"default:0"` // used quota
	Group                  string         `json:"group" gorm:"default:''"`
	CrossGroupRetry        bool           `json:"cross_group_retry"` // 跨分组重试，仅auto分组有效
	Groups                 []string       `json:"groups" gorm:"-"`
	GroupSwitchCodes       []int          `json:"group_switch_status_codes" gorm:"-"`
	GroupSwitchStatusCodes string         `json:"-" gorm:"type:text"`
	GroupSwitchRetryCount  int            `json:"group_switch_retry_count" gorm:"not null;default:0"`
	DeletedAt              gorm.DeletedAt `gorm:"index"`
}

func NormalizeTokenGroups(group string) []string {
	group = strings.TrimSpace(group)
	if group == "[]" {
		return []string{}
	}
	var raw []string
	if strings.HasPrefix(group, "[") {
		_ = json.Unmarshal([]byte(group), &raw)
	} else if group != "" {
		raw = strings.Split(group, ",")
	}
	seen := make(map[string]struct{}, len(raw))
	groups := make([]string, 0, len(raw))
	for _, item := range raw {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		groups = append(groups, item)
	}
	if len(groups) == 0 {
		return []string{"default"}
	}
	return groups
}

func EncodeTokenGroups(groups []string) string {
	if len(groups) == 0 {
		return "[]"
	}
	normalized := NormalizeTokenGroups(strings.Join(groups, ","))
	if len(normalized) == 1 {
		return normalized[0]
	}
	body, _ := json.Marshal(normalized)
	return string(body)
}

func (token *Token) GetGroups() []string {
	if token == nil {
		return []string{"default"}
	}
	return NormalizeTokenGroups(token.Group)
}

// UsesAutoGroups also recognizes the local empty-priority-list representation.
func (token *Token) UsesAutoGroups() bool {
	groups := token.GetGroups()
	return len(groups) == 0 || len(groups) == 1 && groups[0] == "auto"
}

func (token *Token) GetAutoGroups() ([]string, error) {
	if token.AutoGroups == "" {
		return nil, nil
	}
	var groups []string
	err := common.UnmarshalJsonStr(token.AutoGroups, &groups)
	return groups, err
}

func (token *Token) SetAutoGroups(groups []string) error {
	if len(groups) == 0 {
		token.AutoGroups = ""
		return nil
	}
	body, err := common.Marshal(groups)
	if err == nil {
		token.AutoGroups = string(body)
	}
	return err
}

func NormalizeGroupSwitchStatusCodes(codes []int) []int {
	seen := make(map[int]struct{}, len(codes))
	normalized := make([]int, 0, len(codes))
	for _, code := range codes {
		if code < 100 || code > 599 {
			continue
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		normalized = append(normalized, code)
	}
	return normalized
}

func EncodeGroupSwitchStatusCodes(codes []int) string {
	normalized := NormalizeGroupSwitchStatusCodes(codes)
	if len(normalized) == 0 {
		return ""
	}
	body, _ := json.Marshal(normalized)
	return string(body)
}

func (token *Token) NormalizeGroupPolicy() {
	if token == nil {
		return
	}
	if token.Groups == nil {
		token.Groups = token.GetGroups()
	} else if len(token.Groups) == 0 {
		if token.Group != "auto" {
			token.Group = "[]"
		}
	} else {
		token.Groups = NormalizeTokenGroups(strings.Join(token.Groups, ","))
	}
	if len(token.Groups) > 0 {
		token.Group = EncodeTokenGroups(token.Groups)
	}
	if len(token.GroupSwitchCodes) == 0 && token.GroupSwitchStatusCodes != "" {
		_ = json.Unmarshal([]byte(token.GroupSwitchStatusCodes), &token.GroupSwitchCodes)
	}
	token.GroupSwitchCodes = NormalizeGroupSwitchStatusCodes(token.GroupSwitchCodes)
	token.GroupSwitchStatusCodes = EncodeGroupSwitchStatusCodes(token.GroupSwitchCodes)
	if token.GroupSwitchRetryCount < 0 {
		token.GroupSwitchRetryCount = 0
	}
	if token.GroupSwitchRetryCount > 10 {
		token.GroupSwitchRetryCount = 10
	}
	if !token.UsesAutoGroups() {
		token.CrossGroupRetry = len(token.Groups) > 1
	}
}

func (token *Token) Clean() {
	token.Key = ""
}

func MaskTokenKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 4 {
		return strings.Repeat("*", len(key))
	}
	if len(key) <= 8 {
		return key[:2] + "****" + key[len(key)-2:]
	}
	return key[:4] + "**********" + key[len(key)-4:]
}

func (token *Token) GetFullKey() string {
	return token.Key
}

func (token *Token) GetMaskedKey() string {
	return MaskTokenKey(token.Key)
}

func (token *Token) GetIpLimits() []string {
	// delete empty spaces
	//split with \n
	ipLimits := make([]string, 0)
	if token.AllowIps == nil {
		return ipLimits
	}
	cleanIps := strings.ReplaceAll(*token.AllowIps, " ", "")
	if cleanIps == "" {
		return ipLimits
	}
	ips := strings.Split(cleanIps, "\n")
	for _, ip := range ips {
		ip = strings.TrimSpace(ip)
		ip = strings.ReplaceAll(ip, ",", "")
		if ip != "" {
			ipLimits = append(ipLimits, ip)
		}
	}
	return ipLimits
}

// TokenListItem is a projection of tokens, not a separate persisted model.
type TokenListItem struct {
	Id           int    `json:"id"`
	Name         string `json:"name"`
	Key          string `json:"key"`
	Status       int    `json:"status"`
	CreatedTime  int64  `json:"created_time"`
	AccessedTime int64  `json:"accessed_time"`
}

func GetUserTokenList(userId int, startIdx int, num int) ([]TokenListItem, error) {
	tokens := make([]TokenListItem, 0)
	err := DB.Model(&Token{}).Select("id", "name", "key", "status", "created_time", "accessed_time").
		Where("user_id = ?", userId).Order("id desc").Limit(num).Offset(startIdx).Find(&tokens).Error
	for index := range tokens {
		tokens[index].Key = MaskTokenKey(tokens[index].Key)
	}
	return tokens, err
}

// sanitizeLikePattern 校验并清洗用户输入的 LIKE 搜索模式。
// 规则：
//  1. 转义 ! 和 _（使用 ! 作为 ESCAPE 字符，兼容 MySQL/PostgreSQL/SQLite）
//  2. 连续的 % 合并为单个 %
//  3. 最多允许 2 个 %
//  4. 含 % 时（模糊搜索），去掉 % 后关键词长度必须 >= 2
//  5. 不含 % 时按精确匹配
func sanitizeLikePattern(input string) (string, error) {
	// 1. 先转义 ESCAPE 字符 ! 自身，再转义 _
	//    使用 ! 而非 \ 作为 ESCAPE 字符，避免 MySQL 中反斜杠的字符串转义问题
	input = strings.ReplaceAll(input, "!", "!!")
	input = strings.ReplaceAll(input, `_`, `!_`)
	if err := validateLikePattern(input); err != nil {
		return "", err
	}
	return input, nil
}

func validateLikePattern(input string) error {

	// 2. 连续的 % 直接拒绝
	if strings.Contains(input, "%%") {
		return errors.New("搜索模式中不允许包含连续的 % 通配符")
	}

	// 3. 统计 % 数量，不得超过 2
	count := strings.Count(input, "%")
	if count > 2 {
		return errors.New("搜索模式中最多允许包含 2 个 % 通配符")
	}

	// 4. 含 % 时，去掉 % 后关键词长度必须 >= 2
	if count > 0 {
		stripped := strings.ReplaceAll(input, "%", "")
		if len(stripped) < 2 {
			return errors.New("使用模糊搜索时，关键词长度至少为 2 个字符")
		}
		return nil
	}

	// 5. 无 % 时，精确全匹配
	return nil
}

const searchHardLimit = 100

func SearchUserTokens(userId int, keyword string, token string, offset int, limit int) (tokens []*Token, total int64, err error) {
	// model 层强制截断
	if limit <= 0 || limit > searchHardLimit {
		limit = searchHardLimit
	}
	if offset < 0 {
		offset = 0
	}

	if token != "" {
		token = strings.TrimPrefix(token, "sk-")
	}

	// 超量用户（令牌数超过上限）只允许精确搜索，禁止模糊搜索
	maxTokens := operation_setting.GetMaxUserTokens()
	hasFuzzy := strings.Contains(keyword, "%") || strings.Contains(token, "%")
	if hasFuzzy {
		count, err := CountUserTokens(userId)
		if err != nil {
			common.SysLog("failed to count user tokens: " + err.Error())
			return nil, 0, errors.New("获取令牌数量失败")
		}
		if int(count) > maxTokens {
			return nil, 0, errors.New("令牌数量超过上限，仅允许精确搜索，请勿使用 % 通配符")
		}
	}

	baseQuery := DB.Model(&Token{}).Where("user_id = ?", userId)

	// 非空才加 LIKE 条件，空则跳过（不过滤该字段）
	if keyword != "" {
		keywordPattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where("name LIKE ? ESCAPE '!'", keywordPattern)
	}
	if token != "" {
		tokenPattern, err := sanitizeLikePattern(token)
		if err != nil {
			return nil, 0, err
		}
		baseQuery = baseQuery.Where(commonKeyCol+" LIKE ? ESCAPE '!'", tokenPattern)
	}

	// 先查匹配总数（用于分页，受 maxTokens 上限保护，避免全表 COUNT）
	err = baseQuery.Limit(maxTokens).Count(&total).Error
	if err != nil {
		common.SysError("failed to count search tokens: " + err.Error())
		return nil, 0, errors.New("搜索令牌失败")
	}

	// 再分页查数据
	err = baseQuery.Order("id desc").Offset(offset).Limit(limit).Find(&tokens).Error
	if err != nil {
		common.SysError("failed to search tokens: " + err.Error())
		return nil, 0, errors.New("搜索令牌失败")
	}
	return tokens, total, nil
}

func ValidateUserToken(key string) (token *Token, err error) {
	if key == "" {
		return nil, ErrTokenNotProvided
	}
	token, err = GetTokenByKey(key, false)
	if err == nil {
		if token.Status == common.TokenStatusExhausted ||
			token.Status == common.TokenStatusExpired ||
			token.Status != common.TokenStatusEnabled {
			return token, ErrTokenInvalid
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			if !common.RedisEnabled {
				token.Status = common.TokenStatusExpired
				err := token.SelectUpdate()
				if err != nil {
					common.SysLog("failed to update token status" + err.Error())
				}
			}
			return token, ErrTokenInvalid
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			if !common.RedisEnabled {
				token.Status = common.TokenStatusExhausted
				err := token.SelectUpdate()
				if err != nil {
					common.SysLog("failed to update token status" + err.Error())
				}
			}
			return token, ErrTokenInvalid
		}
		return token, nil
	}
	common.SysLog("ValidateUserToken: failed to get token: " + err.Error())
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrTokenInvalid
	}
	return nil, fmt.Errorf("%w: %v", ErrDatabase, err)
}

func GetTokenByIds(id int, userId int) (*Token, error) {
	if id == 0 || userId == 0 {
		return nil, errors.New("id 或 userId 为空！")
	}
	token := Token{Id: id, UserId: userId}
	var err error = nil
	err = DB.First(&token, "id = ? and user_id = ?", id, userId).Error
	return &token, err
}

func GetTokenById(id int) (*Token, error) {
	if id == 0 {
		return nil, errors.New("token id is empty")
	}
	token := Token{Id: id}
	var err error = nil
	err = DB.First(&token, "id = ?", id).Error
	return &token, err
}

func GetTokenByKey(key string, fromDB bool) (token *Token, err error) {
	if !fromDB && common.RedisEnabled {
		// Try Redis first
		token, err := cacheGetTokenByKey(key)
		if err == nil {
			return token, nil
		}
		// Don't return error - fall through to DB
	}
	token = &Token{}
	if err = DB.Where(commonKeyCol+" = ?", key).First(token).Error; err != nil {
		return nil, err
	}
	if common.RedisEnabled {
		// 冷缓存时用数据库快照初始化；已存在的哈希只刷新 TTL，
		// 避免快照覆盖 Redis 中已被原子预扣的余额。初始化失败不影响本次读取。
		if _, cacheErr := cacheInitToken(*token); cacheErr != nil {
			common.SysLog(common.LogText("failed to init token cache: %s", cacheErr.Error()))
		}
	}
	return token, nil
}

func (token *Token) Insert() error {
	var err error
	err = DB.Create(token).Error
	return err
}

// Update Make sure your token's fields is completed, because this will update non-zero values
// fenceMetadataMutation resolves the stored key rather than trusting caller metadata.
// Mutations stop on cache failure so a successful permission change cannot leave
// an old, permissive hash available to another request.
func (token *Token) fenceMetadataMutation() error {
	if !common.RedisEnabled {
		return nil
	}
	var stored Token
	if err := DB.Select(commonKeyCol).First(&stored, token.Id).Error; err != nil {
		return err
	}
	return invalidateTokenCacheForMutation(stored.Key)
}

func (token *Token) Update() error {
	if err := token.fenceMetadataMutation(); err != nil {
		return err
	}
	return DB.Model(token).Select("name", "status", "expired_time", "remain_quota", "unlimited_quota",
		"allow_user_quota_query", "model_limits_enabled", "model_limits", "allow_ips", "group", "cross_group_retry", "auto_groups", "group_switch_status_codes", "group_switch_retry_count").Updates(token).Error
}

func (token *Token) SelectUpdate() error {
	if err := token.fenceMetadataMutation(); err != nil {
		return err
	}
	return DB.Model(token).Select("status").Updates(token).Error
}

// RecordTokenUsage records an authenticated API request independently of quota
// settlement, refunds and management operations. Concurrent requests cannot
// overwrite a newer timestamp with an older one.
func RecordTokenUsage(token *Token) error {
	now := common.GetTimestamp()
	if err := DB.Model(&Token{}).Where("id = ? AND (accessed_time IS NULL OR accessed_time < ?)", token.Id, now).
		UpdateColumn("accessed_time", now).Error; err != nil {
		return err
	}
	if common.RedisEnabled {
		if err := cacheRecordTokenUsage(token.Id, token.Key, now); err != nil {
			common.SysLog(common.LogText("failed to cache token usage time: %s", err.Error()))
		}
	}
	return nil
}

func (token *Token) Delete() error {
	if err := token.fenceMetadataMutation(); err != nil {
		return err
	}
	return DB.Delete(token).Error
}

func (token *Token) GetModelLimits() []string {
	if token.ModelLimits == "" {
		return []string{}
	}
	return strings.Split(token.ModelLimits, ",")
}

func (token *Token) GetModelLimitsMap() map[string]bool {
	limits := token.GetModelLimits()
	limitsMap := make(map[string]bool)
	for _, limit := range limits {
		limitsMap[limit] = true
	}
	return limitsMap
}

func DeleteTokenById(id int, userId int) (err error) {
	// Why we need userId here? In case user want to delete other's token.
	if id == 0 || userId == 0 {
		return errors.New("id 或 userId 为空！")
	}
	token := Token{Id: id, UserId: userId}
	err = DB.Where(token).First(&token).Error
	if err != nil {
		return err
	}
	return token.Delete()
}

func IncreaseTokenQuota(tokenId int, key string, quota int) (err error) {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	if common.RedisEnabled {
		gopool.Go(func() {
			// 守卫式增量：哈希不存在时跳过，由下次读取从数据库水合，
			// 绝不创建只有配额字段的残缺哈希。
			if _, err := cacheApplyTokenQuotaDelta(tokenId, key, int64(quota)); err != nil {
				common.SysLog(common.LogText("failed to increase token quota: %s", err.Error()))
			}
		})
	}
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, tokenId, quota)
		return nil
	}
	return increaseTokenQuota(tokenId, quota)
}

func increaseTokenQuota(id int, quota int) (err error) {
	err = DB.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]interface{}{
			"remain_quota": gorm.Expr("remain_quota + ?", quota),
			"used_quota":   gorm.Expr("used_quota - ?", quota),
		},
	).Error
	return err
}

func DecreaseTokenQuota(id int, key string, quota int) (err error) {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	if common.RedisEnabled {
		gopool.Go(func() {
			if _, err := cacheApplyTokenQuotaDelta(id, key, int64(-quota)); err != nil {
				common.SysLog(common.LogText("failed to decrease token quota: %s", err.Error()))
			}
		})
	}
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeTokenQuota, id, -quota)
		return nil
	}
	return decreaseTokenQuota(id, quota)
}

func decreaseTokenQuota(id int, quota int) (err error) {
	err = DB.Model(&Token{}).Where("id = ?", id).Updates(
		map[string]interface{}{
			"remain_quota": gorm.Expr("remain_quota - ?", quota),
			"used_quota":   gorm.Expr("used_quota + ?", quota),
		},
	).Error
	return err
}

// CountUserTokens returns total number of tokens for the given user, used for pagination
func CountUserTokens(userId int) (int64, error) {
	var total int64
	err := DB.Model(&Token{}).Where("user_id = ?", userId).Count(&total).Error
	return total, err
}

// BatchDeleteTokens 删除指定用户的一组令牌，返回成功删除数量
func BatchDeleteTokens(ids []int, userId int) (int, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空！")
	}
	var tokens []Token
	var deleted int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("user_id = ? AND id IN (?)", userId, ids).Order("id").Find(&tokens).Error; err != nil {
			return err
		}
		for _, token := range tokens {
			if err := invalidateTokenCacheForMutation(token.Key); err != nil {
				return err
			}
		}
		result := tx.Where("user_id = ? AND id IN (?)", userId, ids).Delete(&Token{})
		deleted = result.RowsAffected
		return result.Error
	})
	if err != nil {
		return 0, err
	}
	return int(deleted), nil
}

func GetTokenKeysByIds(ids []int, userId int) ([]Token, error) {
	var tokens []Token
	err := DB.Select("id", commonKeyCol).
		Where("user_id = ? AND id IN (?)", userId, ids).
		Find(&tokens).Error
	return tokens, err
}

// InvalidateUserTokensCache 清理指定用户所有令牌在 Redis 中的缓存，
// 配合 InvalidateUserCache 使用，可在用户被禁用/删除时立即阻断其令牌的请求。
// 下一次请求将从数据库重新加载令牌及用户状态，从而立即识别出被禁用的用户。
func InvalidateUserTokensCache(userId int) error {
	if !common.RedisEnabled {
		return nil
	}
	if userId <= 0 {
		return errors.New("userId 无效")
	}
	var tokens []Token
	if err := DB.Unscoped().
		Select("id", commonKeyCol).
		Where("user_id = ?", userId).
		Find(&tokens).Error; err != nil {
		return err
	}
	var firstErr error
	for _, t := range tokens {
		if t.Key == "" {
			continue
		}
		if err := cacheDeleteToken(t.Key); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func invalidateTokensCache(tokens []Token) error {
	if !common.RedisEnabled {
		return nil
	}
	var firstErr error
	for _, t := range tokens {
		if t.Key == "" {
			continue
		}
		if err := cacheDeleteToken(t.Key); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}
