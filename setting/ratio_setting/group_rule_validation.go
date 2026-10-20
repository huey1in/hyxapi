package ratio_setting

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
)

func ValidateGroupGroupRatio(raw string) error {
	var groups map[string]map[string]*float64
	if err := json.Unmarshal([]byte(raw), &groups); err != nil {
		return err
	}
	if groups == nil {
		return errors.New("group multipliers must be a JSON object")
	}
	for userGroup, targets := range groups {
		if strings.TrimSpace(userGroup) == "" || targets == nil {
			return errors.New("each user group must contain an object of group multipliers")
		}
		for target, ratio := range targets {
			if strings.TrimSpace(target) == "" || ratio == nil || *ratio < 0 || math.IsNaN(*ratio) || math.IsInf(*ratio, 0) {
				return errors.New("group multipliers must be finite numbers greater than or equal to zero")
			}
		}
	}
	return nil
}

func ValidateGroupSpecialUsableGroups(raw string) error {
	var groups map[string]map[string]*string
	if err := json.Unmarshal([]byte(raw), &groups); err != nil {
		return err
	}
	if groups == nil {
		return errors.New("usable group rules must be a JSON object")
	}
	for userGroup, targets := range groups {
		if strings.TrimSpace(userGroup) == "" || targets == nil {
			return errors.New("each user group must contain an object of usable group rules")
		}
		for target, description := range targets {
			group := target
			if strings.HasPrefix(group, "+:") || strings.HasPrefix(group, "-:") {
				group = group[2:]
			}
			if strings.TrimSpace(group) == "" || description == nil {
				return errors.New("usable group rules require group names and string descriptions")
			}
		}
	}
	return nil
}
