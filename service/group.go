package service

import (
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// GetUserUsableGroups returns all groups available for token creation.
func GetUserUsableGroups(_ string) map[string]string {
	return setting.GetUserUsableGroupsCopy()
}

func GroupInUserUsableGroups(_, groupName string) bool {
	_, ok := GetUserUsableGroups("")[groupName]
	return ok
}

// GetUserGroupRatio returns the base group ratio.
func GetUserGroupRatio(_, group string) float64 {
	return ratio_setting.GetGroupRatio(group)
}
