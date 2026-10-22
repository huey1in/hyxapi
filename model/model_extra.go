package model

// GetModelQuotaTypes 返回指定模型的计费类型集合（来自缓存）。
func GetModelQuotaTypes(modelName string) []int {
	GetPricing()
	modelEnableGroupsLock.RLock()
	quotaType, ok := modelQuotaTypeMap[modelName]
	modelEnableGroupsLock.RUnlock()
	if ok {
		return []int{quotaType}
	}
	return []int{}
}
