package ratio_setting

import "strings"

func normalizeThinkingBudgetModel(name, prefix, wildcard string) string {
	if strings.HasPrefix(name, prefix) && strings.Contains(name, "-thinking-") {
		return wildcard
	}
	return name
}

// FormatMatchingModelName normalizes parameterized model names for channel
// ability matching. It is unrelated to pricing and remains here because the
// channel selection layer already depends on this package for group settings.
func FormatMatchingModelName(name string) string {
	switch {
	case strings.HasPrefix(name, "gemini-2.5-flash-lite"):
		name = normalizeThinkingBudgetModel(name, "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-thinking-*")
	case strings.HasPrefix(name, "gemini-2.5-flash"):
		name = normalizeThinkingBudgetModel(name, "gemini-2.5-flash", "gemini-2.5-flash-thinking-*")
	case strings.HasPrefix(name, "gemini-2.5-pro"):
		name = normalizeThinkingBudgetModel(name, "gemini-2.5-pro", "gemini-2.5-pro-thinking-*")
	}
	if strings.HasPrefix(name, "gpt-4-gizmo") {
		return "gpt-4-gizmo-*"
	}
	if strings.HasPrefix(name, "gpt-4o-gizmo") {
		return "gpt-4o-gizmo-*"
	}
	return name
}
