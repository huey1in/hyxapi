package reasoning

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseDeepSeekModel applies explicit modifiers after legacy effort tails.
// The rightmost value for a repeated modifier wins.
func ParseDeepSeekModel(model string) (base, thinking, effort string, modified bool, err error) {
	parts := strings.Split(model, "@")
	base, thinking, effort, modified = ParseDeepSeekV4ThinkingSuffix(parts[0])
	if len(parts) == 1 {
		return
	}
	if !strings.HasPrefix(base, "deepseek-") {
		return model, "", "", false, nil
	}
	last := map[string]int{}
	for i, part := range parts[1:] {
		key, _, _ := strings.Cut(part, ":")
		last[strings.ToLower(key)] = i
	}
	for i, part := range parts[1:] {
		key, value, ok := strings.Cut(part, ":")
		key = strings.ToLower(key)
		value = strings.ToLower(strings.TrimSpace(value))
		if !ok {
			return model, "", "", false, fmt.Errorf("invalid model modifier %q", part)
		}
		if last[key] != i {
			continue
		}
		switch key {
		case "effort":
			switch value {
			case "none":
				thinking, effort = "disabled", ""
			case "low", "medium", "high", "xhigh", "max", "minimal":
				thinking, effort = "enabled", value
			default:
				return model, "", "", false, fmt.Errorf("invalid effort %q", value)
			}
		case "thinking":
			switch value {
			case "off", "0":
				thinking, effort = "disabled", ""
			case "on", "adaptive", "-1":
				thinking, effort = "enabled", ""
			default:
				budget, parseErr := strconv.Atoi(value)
				if parseErr != nil || budget < 1 {
					return model, "", "", false, fmt.Errorf("invalid thinking %q", value)
				}
				thinking, effort = "enabled", "high"
				if budget <= 1024 {
					effort = "low"
				} else if budget > 24576 {
					effort = "max"
				}
			}
		default:
			return model, "", "", false, fmt.Errorf("unsupported model modifier %q", key)
		}
		modified = true
	}
	return
}

func DeepSeekRoutingModel(model string) string {
	if !strings.HasPrefix(model, "deepseek-") {
		return model
	}
	base, _, _, _, err := ParseDeepSeekModel(model)
	if err != nil {
		return model
	}
	return base
}
