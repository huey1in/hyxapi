package service

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func GetUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			// 处理特殊可用分组
			for specialGroup, desc := range specialSettings {
				if after, ok := strings.CutPrefix(specialGroup, "-:"); ok {
					// 移除分组
					groupToRemove := after
					delete(groupsCopy, groupToRemove)
				} else if after, ok := strings.CutPrefix(specialGroup, "+:"); ok {
					// 添加分组
					groupToAdd := after
					groupsCopy[groupToAdd] = desc
				} else {
					// 直接添加分组
					groupsCopy[specialGroup] = desc
				}
			}
		}
		// 如果userGroup不在UserUsableGroups中，返回UserUsableGroups + userGroup。
		// 描述是英文源文本，由 web 控制台翻译；管理员配置的描述原样显示。
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "User group"
		}
	}
	return groupsCopy
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func IsUserSelectableGroup(userGroup, groupName string) bool {
	if groupName == "" || groupName == "auto" {
		return false
	}
	return GroupInUserUsableGroups(userGroup, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

// GetUserSelectableGroups returns actual permitted groups in the same stable
// order as the dashboard's JSON group dictionary, without inventing default.
func GetUserSelectableGroups(userGroup string) []string {
	usable := GetUserUsableGroups(userGroup)
	groups := make([]string, 0, len(usable))
	for group := range usable {
		if group != "" && group != "auto" && ratio_setting.ContainsGroupRatio(group) {
			groups = append(groups, group)
		}
	}
	sort.Strings(groups)
	return groups
}

// Auto routing discovers all permitted groups. The administrator's list only
// breaks ties; adding a group does not require maintaining a second allowlist.
func GetUserAutoGroup(userGroup string) []string {
	available := GetUserSelectableGroups(userGroup)
	allowed := make(map[string]bool, len(available))
	for _, group := range available {
		allowed[group] = true
	}
	autoGroups := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range append(setting.GetAutoGroups(), available...) {
		if !allowed[group] {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		autoGroups = append(autoGroups, group)
	}
	return sortAutoGroupsByCost(userGroup, autoGroups)
}

// The special user-group rate replaces the base rate, exactly as in billing.
// A stable sort keeps configured priorities when effective rates are equal.
func sortAutoGroupsByCost(userGroup string, groups []string) []string {
	ratios := make(map[string]float64, len(groups))
	for _, group := range groups {
		ratio, special := ratio_setting.GetGroupGroupRatio(userGroup, group)
		if !special {
			ratio = ratio_setting.GetGroupRatio(group)
		}
		ratios[group] = ratio
	}
	sort.SliceStable(groups, func(i, j int) bool { return ratios[groups[i]] < ratios[groups[j]] })
	return groups
}

// FilterUserTokenAutoGroups applies current permissions before the current
// per-token limit, then prefers the lowest effective rate. An explicit token
// restriction never falls back to other groups when its grants are revoked.
func FilterUserTokenAutoGroups(userGroup string, groups []string) []string {
	maxCount := setting.GetMaxTokenAutoGroups()
	filtered := make([]string, 0, min(len(groups), maxCount))
	seen := make(map[string]struct{})
	for _, group := range groups {
		if !IsUserSelectableGroup(userGroup, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		filtered = append(filtered, group)
		if len(filtered) == maxCount {
			break
		}
	}
	return sortAutoGroupsByCost(userGroup, filtered)
}

// GetRequestAutoGroups resolves the ordered Auto groups for the current token.
// The absence of the context value means automatic discovery of all permitted
// groups; a present (even empty) value is an explicit token restriction.
func GetRequestAutoGroups(c *gin.Context, userGroup string) []string {
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
	if !ok {
		return GetUserAutoGroup(userGroup)
	}
	groups, ok := value.([]string)
	if !ok {
		return []string{}
	}
	return FilterUserTokenAutoGroups(userGroup, groups)
}

// GetGroupsEnabledModels 按 groups 顺序获取各分组启用的模型并去重
func GetGroupsEnabledModels(groups []string) []string {
	seen := make(map[string]struct{})
	models := make([]string, 0)
	for _, group := range groups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			if _, ok := seen[modelName]; !ok {
				seen[modelName] = struct{}{}
				models = append(models, modelName)
			}
		}
	}
	return models
}
