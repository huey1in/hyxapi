package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestChannelPriorityUpdatesAbilitiesAndRollsBackConflicts(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM abilities") })
	channels := []Channel{{Name: "priority-a", Priority: common.GetPointer(int64(10))}, {Name: "priority-b"}}
	require.NoError(t, DB.Create(&channels).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "priority-test", ChannelId: channels[0].Id, Priority: common.GetPointer(int64(10))}).Error)
	require.NoError(t, UpdateChannelPriorities([]ChannelPriorityChange{{ID: channels[0].Id, Before: 10, Priority: 20}}))
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channels[0].Id).First(&ability).Error)
	require.Equal(t, int64(20), *ability.Priority)
	err := UpdateChannelPriorities([]ChannelPriorityChange{{ID: channels[0].Id, Before: 20, Priority: 30}, {ID: channels[1].Id, Before: 9, Priority: 5}})
	require.Error(t, err)
	var channel Channel
	require.NoError(t, DB.First(&channel, channels[0].Id).Error)
	require.Equal(t, int64(20), channel.GetPriority())
}

func TestChannelPriorityMoveShiftsHiddenDenseTiersAndCanBeUndone(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM abilities") })
	channels := []Channel{
		{Name: "source", Priority: common.GetPointer(int64(0))},
		{Name: "target", Priority: common.GetPointer(int64(10))},
		{Name: "hidden-peer-a", Priority: common.GetPointer(int64(11))},
		{Name: "hidden-peer-b", Priority: common.GetPointer(int64(11))},
		{Name: "hidden-next", Priority: common.GetPointer(int64(12))},
		{Name: "far-tier", Priority: common.GetPointer(int64(20))},
	}
	for i := range channels {
		require.NoError(t, DB.Create(&channels[i]).Error)
		require.NoError(t, DB.Create(&Ability{ChannelId: channels[i].Id, Group: "default", Model: "priority-move", Priority: channels[i].Priority}).Error)
	}
	move := ChannelPriorityMove{SourceID: channels[0].Id, TargetID: channels[1].Id, SourceBefore: 0, TargetBefore: 10, Placement: "before"}
	changes, err := MoveChannelPriority(move)
	require.NoError(t, err)
	require.Len(t, changes, 4)
	for i, expected := range []int64{11, 10, 12, 12, 13, 20} {
		var channel Channel
		require.NoError(t, DB.First(&channel, channels[i].Id).Error)
		require.Equal(t, expected, channel.GetPriority())
		var ability Ability
		require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
		require.Equal(t, expected, *ability.Priority)
	}
	_, err = MoveChannelPriority(move)
	require.Error(t, err, "a stale drag must not overwrite newer priorities")
	for i := range changes {
		changes[i].Before, changes[i].Priority = changes[i].Priority, changes[i].Before
	}
	require.NoError(t, UpdateChannelPriorities(changes))
	var source Channel
	require.NoError(t, DB.First(&source, channels[0].Id).Error)
	require.Zero(t, source.GetPriority())
}
