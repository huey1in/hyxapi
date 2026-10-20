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

func TestTokenAutoGroupRetryCoexistsWithManualPriorityPolicy(t *testing.T) {
	for _, group := range []string{"auto", "[]"} {
		token := &Token{Group: group, CrossGroupRetry: true}
		token.NormalizeGroupPolicy()
		require.True(t, token.UsesAutoGroups())
		require.True(t, token.CrossGroupRetry)
		token.NormalizeGroupPolicy()
		require.True(t, token.CrossGroupRetry, "repeated reads must preserve the Auto retry setting")
	}
	manual := &Token{Groups: []string{"vip", "default"}, CrossGroupRetry: false}
	manual.NormalizeGroupPolicy()
	falseAuto := &Token{Group: "auto", Groups: []string{}}
	falseAuto.NormalizeGroupPolicy()
	falseAuto.NormalizeGroupPolicy()
	require.Equal(t, "auto", falseAuto.Group)
	require.False(t, falseAuto.CrossGroupRetry)
	require.True(t, manual.CrossGroupRetry)
	require.False(t, manual.UsesAutoGroups())
}
