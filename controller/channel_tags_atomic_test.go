package controller

import (
	"context"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func newTagFixture(t *testing.T, tag, name string) *model.Channel {
	t.Helper()
	priority, weight := int64(9), uint(4)
	channel := &model.Channel{Type: 1, Name: name, Tag: &tag, Models: "keep", Group: "default", Key: "preserve-fixture", Status: 1, Priority: &priority, Weight: &weight, Balance: 31, UsedQuota: 9876}
	require.NoError(t, channel.Insert())
	return channel
}

func TestSelectedChannelTagsMatchRoutingAndRollbackTogether(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	one, two := newTagFixture(t, "old", "one"), newTagFixture(t, "old", "two")
	newTag := "new"
	count, err := model.SetSelectedChannelTags(context.Background(), []int{one.Id, one.Id, two.Id}, &newTag)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	var abilities []model.Ability
	require.NoError(t, db.Find(&abilities).Error)
	require.Len(t, abilities, 2)
	for _, ability := range abilities {
		require.NotNil(t, ability.Tag)
		require.Equal(t, newTag, *ability.Tag)
	}
	require.NoError(t, db.Exec("CREATE TEMP TRIGGER tag_fixture_failure BEFORE UPDATE OF tag ON abilities BEGIN SELECT RAISE(ABORT,'fixture tag failure'); END").Error)
	_, err = model.SetSelectedChannelTags(context.Background(), []int{one.Id, two.Id}, nil)
	require.ErrorContains(t, err, "fixture tag failure")
	for _, id := range []int{one.Id, two.Id} {
		stored, err := model.GetChannelById(id, true)
		require.NoError(t, err)
		require.Equal(t, "new", stored.GetTag())
		require.EqualValues(t, 31, stored.Balance)
	}
	require.NoError(t, db.Exec("DROP TRIGGER tag_fixture_failure").Error)
	_, err = model.SetSelectedChannelTags(context.Background(), []int{one.Id, 99999}, nil)
	require.Error(t, err)
	count, err = model.SetSelectedChannelTags(context.Background(), []int{one.Id}, nil)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var ability model.Ability
	require.NoError(t, db.Where("channel_id = ?", one.Id).First(&ability).Error)
	require.Nil(t, ability.Tag)
}

func TestTagEditingPreservesUnselectedChannelsAndExplicitZeroes(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	one, two := newTagFixture(t, "old", "one"), newTagFixture(t, "old", "two")
	other := newTagFixture(t, "merged", "other")
	newTag, models, group, mapping := "merged", "changed", "custom", `{"alias":"changed"}`
	priority, weight := int64(0), uint(0)
	change := model.ChannelTagChanges{NewTag: &newTag, Models: &models, Groups: &group, ModelMapping: &mapping, Priority: &priority, Weight: &weight}
	require.NoError(t, db.Exec(fmt.Sprintf("CREATE TEMP TRIGGER tag_edit_failure BEFORE INSERT ON abilities WHEN NEW.channel_id=%d BEGIN SELECT RAISE(ABORT,'fixture route failure'); END", two.Id)).Error)
	_, err := model.EditChannelsByTag(context.Background(), "old", change)
	require.ErrorContains(t, err, "fixture route failure")
	stored, err := model.GetChannelById(one.Id, true)
	require.NoError(t, err)
	require.Equal(t, "old", stored.GetTag())
	require.Equal(t, "keep", stored.Models)
	require.NoError(t, db.Exec("DROP TRIGGER tag_edit_failure").Error)
	count, err := model.EditChannelsByTag(context.Background(), "old", change)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	for _, id := range []int{one.Id, two.Id} {
		stored, err := model.GetChannelById(id, true)
		require.NoError(t, err)
		require.Equal(t, "merged", stored.GetTag())
		require.Equal(t, "changed", stored.Models)
		require.Zero(t, stored.GetPriority())
		require.Zero(t, stored.GetWeight())
		require.EqualValues(t, 9876, stored.UsedQuota)
		require.EqualValues(t, 31, stored.Balance)
		require.Equal(t, "preserve-fixture", stored.Key)
		var ability model.Ability
		require.NoError(t, db.Where("channel_id = ?", id).First(&ability).Error)
		require.Equal(t, "changed", ability.Model)
		require.Equal(t, "custom", ability.Group)
		require.Zero(t, *ability.Priority)
		require.Zero(t, ability.Weight)
		require.Equal(t, "merged", *ability.Tag)
	}
	stored, err = model.GetChannelById(other.Id, true)
	require.NoError(t, err)
	require.Equal(t, "keep", stored.Models)
	empty := ""
	_, err = model.EditChannelsByTag(context.Background(), "merged", model.ChannelTagChanges{Models: &empty, ModelMapping: &empty})
	require.NoError(t, err)
	var total int64
	require.NoError(t, db.Model(&model.Ability{}).Count(&total).Error)
	require.Zero(t, total)
}

func TestTagStatusRollbackAndCanceledOperations(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	one, two := newTagFixture(t, "status", "one"), newTagFixture(t, "status", "two")
	require.NoError(t, db.Exec("CREATE TEMP TRIGGER tag_status_failure BEFORE UPDATE OF enabled ON abilities BEGIN SELECT RAISE(ABORT,'fixture status failure'); END").Error)
	_, err := model.SetChannelTagStatus(context.Background(), "status", common.ChannelStatusManuallyDisabled)
	require.ErrorContains(t, err, "fixture status failure")
	stored, err := model.GetChannelById(one.Id, true)
	require.NoError(t, err)
	require.Equal(t, 1, stored.Status)
	require.NoError(t, db.Exec("DROP TRIGGER tag_status_failure").Error)
	count, err := model.SetChannelTagStatus(context.Background(), "status", common.ChannelStatusManuallyDisabled)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	var enabled int64
	require.NoError(t, db.Model(&model.Ability{}).Where("enabled = ?", true).Count(&enabled).Error)
	require.Zero(t, enabled)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = model.SetChannelTagStatus(ctx, "status", 1)
	require.Error(t, err)
	_, err = model.SetSelectedChannelTags(ctx, []int{one.Id, two.Id}, nil)
	require.Error(t, err)
	stored, err = model.GetChannelById(two.Id, true)
	require.NoError(t, err)
	require.Equal(t, 2, stored.Status)
}
