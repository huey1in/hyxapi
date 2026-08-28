package model

func GetModelEnableGroups(modelName string) []string {
	// 确保缓存最新
	GetPricing()

	if modelName == "" {
		return make([]string, 0)
	}

	modelEnableGroupsLock.RLock()
	groups, ok := modelEnableGroups[modelName]
	modelEnableGroupsLock.RUnlock()
	if !ok {
		return make([]string, 0)
	}
	return groups
}

// GetModelQuotaTypes 返回指定模型的计费类型集合（来自缓存）。
// 本地二开将上游「比例计费配额类型(int)」改为「直价计费 BillingType(string)」，
// 无等价的整数配额类型可映射，故恒返回空集合。
func GetModelQuotaTypes(modelName string) []int {
	return []int{}
}
