package console_setting

import (
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/QuantumNous/new-api/common"
)

const maxAnnouncementContentCharacters = 10000

var (
	urlRegex       = regexp.MustCompile(`^https?://(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))(?:\:[0-9]{1,5})?(?:/.*)?$`)
	dangerousChars = []string{"<script", "<iframe", "javascript:", "onload=", "onerror=", "onclick="}
	slugRegex      = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
)

func parseJSONArray(jsonStr string, formatErrorKey string) ([]map[string]any, error) {
	var list []map[string]any
	if err := common.UnmarshalJsonStr(jsonStr, &list); err != nil {
		return nil, common.NewMessage(formatErrorKey, map[string]any{"error": err.Error()})
	}
	return list, nil
}

func exceedsMaxCharacters(s string, max int) bool {
	return len(utf16.Encode([]rune(s))) > max
}

func validateURL(urlStr string, index int) error {
	if !urlRegex.MatchString(urlStr) {
		return common.NewMessage("Group #{{index}} has an invalid URL format", map[string]any{"index": index})
	}
	if _, err := url.Parse(urlStr); err != nil {
		return common.NewMessage("Group #{{index}} has a URL that cannot be parsed: {{error}}", map[string]any{"index": index, "error": err.Error()})
	}
	return nil
}

func checkDangerousContent(content string, index int) error {
	lower := strings.ToLower(content)
	for _, d := range dangerousChars {
		if strings.Contains(lower, d) {
			return common.NewMessage("Group #{{index}} contains disallowed content", map[string]any{"index": index})
		}
	}
	return nil
}

func getJSONList(jsonStr string) []map[string]any {
	if jsonStr == "" {
		return []map[string]any{}
	}
	var list []map[string]any
	_ = common.UnmarshalJsonStr(jsonStr, &list)
	return list
}

func ValidateConsoleSettings(settingsStr string, settingType string) error {
	if settingsStr == "" {
		return nil
	}

	switch settingType {
	case "Announcements":
		return validateAnnouncements(settingsStr)
	case "UptimeKumaGroups":
		return validateUptimeKumaGroups(settingsStr)
	default:
		return common.NewMessage("Unknown setting type: {{type}}", map[string]any{"type": settingType})
	}
}

func validateAnnouncements(announcementsStr string) error {
	list, err := parseJSONArray(announcementsStr, "Invalid announcements format: {{error}}")
	if err != nil {
		return err
	}
	if len(list) > 100 {
		return common.NewMessage("Announcements cannot exceed 100 entries")
	}
	validTypes := map[string]bool{
		"default": true, "ongoing": true, "success": true, "warning": true, "error": true,
	}
	for i, ann := range list {
		content, ok := ann["content"].(string)
		if !ok || content == "" {
			return common.NewMessage("Announcement #{{index}} is missing the content field", map[string]any{"index": i + 1})
		}
		publishDateAny, exists := ann["publishDate"]
		if !exists {
			return common.NewMessage("Announcement #{{index}} is missing the publish date field", map[string]any{"index": i + 1})
		}
		publishDateStr, ok := publishDateAny.(string)
		if !ok || publishDateStr == "" {
			return common.NewMessage("Announcement #{{index}} publish date cannot be empty", map[string]any{"index": i + 1})
		}
		if _, err := time.Parse(time.RFC3339, publishDateStr); err != nil {
			return common.NewMessage("Announcement #{{index}} has an invalid publish date format", map[string]any{"index": i + 1})
		}
		if t, exists := ann["type"]; exists {
			if typeStr, ok := t.(string); ok {
				if !validTypes[typeStr] {
					return common.NewMessage("Announcement #{{index}} has an invalid type value", map[string]any{"index": i + 1})
				}
			}
		}
		if exceedsMaxCharacters(content, maxAnnouncementContentCharacters) {
			return common.NewMessage("Announcement #{{index}} content cannot exceed {{limit}} characters", map[string]any{"index": i + 1, "limit": maxAnnouncementContentCharacters})
		}
		if extra, exists := ann["extra"]; exists {
			if extraStr, ok := extra.(string); ok && exceedsMaxCharacters(extraStr, 100) {
				return common.NewMessage("Announcement #{{index}} note cannot exceed 100 characters", map[string]any{"index": i + 1})
			}
		}
	}
	return nil
}

func getPublishTime(item map[string]any) time.Time {
	if v, ok := item["publishDate"]; ok {
		if s, ok2 := v.(string); ok2 {
			if t, err := time.Parse(time.RFC3339, s); err == nil {
				return t
			}
		}
	}
	return time.Time{}
}

func GetAnnouncements() []map[string]any {
	list := getJSONList(GetConsoleSetting().Announcements)
	sort.SliceStable(list, func(i, j int) bool {
		return getPublishTime(list[i]).After(getPublishTime(list[j]))
	})
	return list
}

func validateUptimeKumaGroups(groupsStr string) error {
	groups, err := parseJSONArray(groupsStr, "Invalid Uptime Kuma group settings format: {{error}}")
	if err != nil {
		return err
	}

	if len(groups) > 20 {
		return common.NewMessage("Uptime Kuma groups cannot exceed 20 entries")
	}

	nameSet := make(map[string]bool)

	for i, group := range groups {
		categoryName, ok := group["categoryName"].(string)
		if !ok || categoryName == "" {
			return common.NewMessage("Group #{{index}} is missing the category name field", map[string]any{"index": i + 1})
		}
		if nameSet[categoryName] {
			return common.NewMessage("Group #{{index}} category name duplicates another group", map[string]any{"index": i + 1})
		}
		nameSet[categoryName] = true
		urlStr, ok := group["url"].(string)
		if !ok || urlStr == "" {
			return common.NewMessage("Group #{{index}} is missing the URL field", map[string]any{"index": i + 1})
		}
		slug, ok := group["slug"].(string)
		if !ok || slug == "" {
			return common.NewMessage("Group #{{index}} is missing the slug field", map[string]any{"index": i + 1})
		}
		description, ok := group["description"].(string)
		if !ok {
			description = ""
		}

		if err := validateURL(urlStr, i+1); err != nil {
			return err
		}

		if exceedsMaxCharacters(categoryName, 50) {
			return common.NewMessage("Group #{{index}} category name cannot exceed 50 characters", map[string]any{"index": i + 1})
		}
		if exceedsMaxCharacters(urlStr, 500) {
			return common.NewMessage("Group #{{index}} URL cannot exceed 500 characters", map[string]any{"index": i + 1})
		}
		if exceedsMaxCharacters(slug, 100) {
			return common.NewMessage("Group #{{index}} slug cannot exceed 100 characters", map[string]any{"index": i + 1})
		}
		if exceedsMaxCharacters(description, 200) {
			return common.NewMessage("Group #{{index}} description cannot exceed 200 characters", map[string]any{"index": i + 1})
		}

		if !slugRegex.MatchString(slug) {
			return common.NewMessage("Group #{{index}} slug can only contain letters, numbers, underscores and hyphens", map[string]any{"index": i + 1})
		}

		if err := checkDangerousContent(description, i+1); err != nil {
			return err
		}
		if err := checkDangerousContent(categoryName, i+1); err != nil {
			return err
		}
	}
	return nil
}

func GetUptimeKumaGroups() []map[string]any {
	return getJSONList(GetConsoleSetting().UptimeKumaGroups)
}
