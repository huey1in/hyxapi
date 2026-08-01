package service

import (
	"sort"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// GetUserUsableGroups returns all groups available for token creation.
func GetUserUsableGroups(_ string) map[string]string {
	return setting.GetUserUsableGroupsCopy()
}

func CheapestGroupsForModel(modelName string) []string {
	usable := GetUserUsableGroups("")
	type candidate struct {
		name  string
		ratio float64
	}
	candidates := make([]candidate, 0, len(usable))
	for group := range usable {
		if !ratio_setting.ContainsGroupRatio(group) {
			continue
		}
		channel, err := model.GetRandomSatisfiedChannel(group, modelName, 0, nil)
		if err == nil && channel != nil {
			candidates = append(candidates, candidate{name: group, ratio: ratio_setting.GetGroupRatio(group)})
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].ratio == candidates[j].ratio {
			return candidates[i].name < candidates[j].name
		}
		return candidates[i].ratio < candidates[j].ratio
	})
	groups := make([]string, len(candidates))
	for i := range candidates {
		groups[i] = candidates[i].name
	}
	return groups
}

func GroupInUserUsableGroups(_, groupName string) bool {
	_, ok := GetUserUsableGroups("")[groupName]
	return ok
}
