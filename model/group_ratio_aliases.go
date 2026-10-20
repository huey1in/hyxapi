package model

import (
	"fmt"
	"maps"
)

func canonicalGroupRatioOption(key string) string {
	switch key {
	case "group_ratio_setting.group_ratio":
		return "GroupRatio"
	case "group_ratio_setting.group_group_ratio":
		return "GroupGroupRatio"
	default:
		return key
	}
}

func groupRatioOptionAlias(key string) string {
	switch key {
	case "GroupRatio":
		return "group_ratio_setting.group_ratio"
	case "GroupGroupRatio":
		return "group_ratio_setting.group_group_ratio"
	default:
		return ""
	}
}

func normalizedGroupRatioOptions(values map[string]string) (map[string]string, error) {
	result := maps.Clone(values)
	for _, key := range []string{"GroupRatio", "GroupGroupRatio"} {
		alias := groupRatioOptionAlias(key)
		value, exists := values[alias]
		if !exists {
			continue
		}
		if original, exists := values[key]; exists && original != value {
			return nil, fmt.Errorf("conflicting values for %s and %s", key, alias)
		}
		result[key] = value
		delete(result, alias)
	}
	return result, nil
}
