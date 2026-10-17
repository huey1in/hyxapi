package reasoning

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDeepSeekExplicitModifiersOverrideTails(t *testing.T) {
	for _, tc := range []struct{ name, base, thinking, effort string }{
		{"deepseek-flash-low", "deepseek-flash", "enabled", "low"},
		{"deepseek-flash-max@thinking:off", "deepseek-flash", "disabled", ""},
		{"deepseek-flash-none@effort:max", "deepseek-flash", "enabled", "max"},
		{"deepseek-v4-pro@effort:low@effort:high", "deepseek-v4-pro", "enabled", "high"},
		{"deepseek-v4-flash@thinking:adaptive", "deepseek-v4-flash", "enabled", ""},
	} {
		base, thinking, effort, modified, err := ParseDeepSeekModel(tc.name)
		require.NoError(t, err)
		require.True(t, modified)
		require.Equal(t, tc.base, base)
		require.Equal(t, tc.thinking, thinking)
		require.Equal(t, tc.effort, effort)
	}
	_, _, _, _, err := ParseDeepSeekModel("deepseek-flash@effort:invalid")
	require.Error(t, err)
}
