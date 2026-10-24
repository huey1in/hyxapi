package console_setting

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAnnouncementContentLength(t *testing.T) {
	for _, test := range []struct {
		name    string
		content string
		valid   bool
	}{
		{name: "complete policy", content: strings.Repeat("用户守则\n", 800), valid: true},
		{name: "limit", content: strings.Repeat("公", maxAnnouncementContentCharacters), valid: true},
		{name: "over limit", content: strings.Repeat("公", maxAnnouncementContentCharacters+1)},
		{name: "UTF-16 limit", content: strings.Repeat("📢", maxAnnouncementContentCharacters/2), valid: true},
		{name: "UTF-16 over limit", content: strings.Repeat("📢", maxAnnouncementContentCharacters/2) + "公"},
	} {
		t.Run(test.name, func(t *testing.T) {
			data, err := json.Marshal([]map[string]any{{
				"content": test.content, "publishDate": "2026-10-24T20:00:00+08:00", "type": "warning",
			}})
			require.NoError(t, err)
			err = ValidateConsoleSettings(string(data), "Announcements")
			if test.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
