package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTokenNormalizeGroupPolicyPreservesPriorityAndRemovesDuplicates(t *testing.T) {
	token := &Token{
		Groups:           []string{"production", "default", "production", ""},
		GroupSwitchCodes: []int{429, 503, 429, 99, 600},
	}

	token.NormalizeGroupPolicy()

	require.Equal(t, []string{"production", "default"}, token.Groups)
	require.Equal(t, `["production","default"]`, token.Group)
	require.Equal(t, []int{429, 503}, token.GroupSwitchCodes)
	require.Equal(t, "[429,503]", token.GroupSwitchStatusCodes)
}

func TestTokenNormalizeGroupPolicyReadsLegacySingleGroup(t *testing.T) {
	token := &Token{Group: "vip"}

	token.NormalizeGroupPolicy()

	require.Equal(t, []string{"vip"}, token.Groups)
	require.Equal(t, "vip", token.Group)
}

func TestTokenNormalizeGroupPolicyPreservesExplicitAutoGroup(t *testing.T) {
	token := &Token{Groups: []string{}}

	token.NormalizeGroupPolicy()

	require.Empty(t, token.Groups)
	require.Equal(t, "[]", token.Group)
}
