package controller

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestOllamaModelSelectionMutatesLatestListAndRoutingTogether(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	channel := &model.Channel{Type: constant.ChannelTypeOllama, Models: "first", Group: "default", Status: 1, UsedQuota: 1234}
	require.NoError(t, channel.Insert())
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("models", "first,concurrent").Error)
	names, err := model.MutateChannelModels(context.Background(), channel.Id, channel.Type, true, []string{"second", "second"})
	require.NoError(t, err)
	require.Equal(t, []string{"first", "concurrent", "second"}, names)
	var abilities []model.Ability
	require.NoError(t, db.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 3)
	require.NoError(t, db.Exec("CREATE TEMP TRIGGER ollama_fail_abilities BEFORE INSERT ON abilities BEGIN SELECT RAISE(ABORT, 'fixture routing failure'); END").Error)
	_, err = model.MutateChannelModels(context.Background(), channel.Id, channel.Type, true, []string{"rollback"})
	require.ErrorContains(t, err, "fixture routing failure")
	require.NoError(t, db.Exec("DROP TRIGGER ollama_fail_abilities").Error)
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "first,concurrent,second", stored.Models)
	require.EqualValues(t, 1234, stored.UsedQuota)
	names, err = model.MutateChannelModels(context.Background(), channel.Id, channel.Type, false, names)
	require.NoError(t, err)
	require.Empty(t, names)
	var count int64
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Count(&count).Error)
	require.Zero(t, count, "removing the last model must not create an empty-name ability")
}
