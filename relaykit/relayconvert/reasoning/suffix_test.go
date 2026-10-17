package reasoning

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseDeepSeekV4ThinkingSuffix(t *testing.T) {
	tests := []struct {
		model        string
		baseModel    string
		thinkingType string
		effort       string
		ok           bool
	}{
		{"deepseek-v4-pro-max", "deepseek-v4-pro", "enabled", "max", true},
		{"deepseek-v4-flash-none", "deepseek-v4-flash", "disabled", "", true},
		{"deepseek-reasoner-max", "deepseek-reasoner-max", "", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			baseModel, thinkingType, effort, ok := ParseDeepSeekV4ThinkingSuffix(tt.model)
			require.Equal(t, tt.baseModel, baseModel)
			require.Equal(t, tt.thinkingType, thinkingType)
			require.Equal(t, tt.effort, effort)
			require.Equal(t, tt.ok, ok)
		})
	}
}
