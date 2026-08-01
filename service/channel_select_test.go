package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRetryParamAdvanceGroupUsesPriorityAndResetsChannelState(t *testing.T) {
	param := &RetryParam{
		TokenGroup:        "production",
		TokenGroups:       []string{"production", "default"},
		SwitchStatusCodes: map[int]struct{}{503: {}},
		Retry:             ptrInt(2),
		ExcludeChannels:   []int{1, 2},
	}

	require.True(t, param.AdvanceGroup(503))
	require.Equal(t, "default", param.TokenGroup)
	require.Equal(t, 1, param.GroupIndex)
	require.Empty(t, param.ExcludeChannels)
	require.Equal(t, 0, param.GetRetry())
	require.False(t, param.AdvanceGroup(503))
}

func TestRetryParamAdvanceGroupIgnoresUnconfiguredStatus(t *testing.T) {
	param := &RetryParam{TokenGroup: "production", TokenGroups: []string{"production", "default"}, SwitchStatusCodes: map[int]struct{}{503: {}}}
	require.False(t, param.AdvanceGroup(429))
	require.Equal(t, "production", param.TokenGroup)
}

func TestRetryParamAdvanceGroupWaitsForConfiguredRetries(t *testing.T) {
	param := &RetryParam{
		TokenGroup: "production", TokenGroups: []string{"production", "default"},
		SwitchStatusCodes: map[int]struct{}{503: {}}, SwitchRetryCount: 2,
	}

	require.False(t, param.AdvanceGroup(503))
	require.True(t, param.ShouldRetryCurrentGroup(503))
	require.False(t, param.AdvanceGroup(503))
	require.True(t, param.ShouldRetryCurrentGroup(503))
	require.True(t, param.AdvanceGroup(503))
	require.Equal(t, "default", param.TokenGroup)
}

func TestRetryParamMaxRetriesIncludesGroupSwitchThreshold(t *testing.T) {
	param := &RetryParam{SwitchRetryCount: 2}

	require.Equal(t, 2, param.MaxRetries(1))
	require.Equal(t, 3, param.MaxRetries(3))
}

func ptrInt(value int) *int { return &value }
