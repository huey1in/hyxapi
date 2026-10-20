package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestChannelSelectionAcceptsModelModifiers(t *testing.T) {
	originalDB, originalCache := DB, common.MemoryCacheEnabled
	originalGroupColumn := commonGroupCol
	originalChannels, originalIndex := channelsIDM, group2model2channels
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	commonGroupCol = "`group`"
	t.Cleanup(func() {
		DB, common.MemoryCacheEnabled = originalDB, originalCache
		commonGroupCol = originalGroupColumn
		channelsIDM, group2model2channels = originalChannels, originalIndex
	})
	channel := Channel{Id: 1, Name: "modifier-test", Status: common.ChannelStatusEnabled, Models: "gpt-5.4", Group: "default"}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, db.Create(&Ability{Group: "default", Model: "gpt-5.4", ChannelId: 1, Enabled: true}).Error)
	channelsIDM = map[int]*Channel{1: &channel}
	group2model2channels = map[string]map[string][]int{"default": {"gpt-5.4": {1}}}
	for _, cached := range []bool{false, true} {
		common.MemoryCacheEnabled = cached
		selected, err := GetRandomSatisfiedChannel("default", "gpt-5.4@effort:high", 0, nil)
		require.NoError(t, err)
		require.NotNil(t, selected)
		require.Equal(t, 1, selected.Id)
		require.True(t, IsChannelEnabledForGroupModel("default", "gpt-5.4@effort:high", 1))
	}
}
