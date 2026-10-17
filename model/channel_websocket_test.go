package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestWebSocketSelectionFiltersUnsupportedPrioritiesAndExclusions(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM abilities") })
	setting := `{"responses_websocket_enabled":true}`
	channels := []Channel{
		{Name: "http-only", Type: constant.ChannelTypeOpenAI, Priority: common.GetPointer(int64(100)), Status: common.ChannelStatusEnabled, Models: "ws-selection", Group: "default"},
		{Name: "ws", Type: constant.ChannelTypeOpenAI, Priority: common.GetPointer(int64(10)), Status: common.ChannelStatusEnabled, Setting: &setting, Models: "ws-selection", Group: "default"},
		{Name: "converter", Type: constant.ChannelTypeAnthropic, Priority: common.GetPointer(int64(200)), Status: common.ChannelStatusEnabled, Setting: &setting, Models: "ws-selection", Group: "default"},
	}
	for i := range channels {
		require.NoError(t, DB.Create(&channels[i]).Error)
		require.NoError(t, channels[i].AddAbilities(nil))
	}
	channel, err := GetResponsesWebSocketChannel("default", "ws-selection", nil)
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, channels[1].Id, channel.Id)
	channel, err = GetResponsesWebSocketChannel("default", "ws-selection", []int{channels[1].Id})
	require.NoError(t, err)
	require.Nil(t, channel)
	channel, err = GetResponsesWebSocketChannel("other-group", "ws-selection", nil)
	require.NoError(t, err)
	require.Nil(t, channel)
}
