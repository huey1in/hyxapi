package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func multiKeyRequest(t *testing.T, request MultiKeyManageRequest) (bool, MultiKeyStatusResponse, string) {
	t.Helper()
	body, err := json.Marshal(request)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1)
	c.Set("role", common.RoleRootUser)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/multi_key/manage", strings.NewReader(string(body)))
	ManageMultiKeys(c)
	var response struct {
		Success bool                   `json:"success"`
		Data    MultiKeyStatusResponse `json:"data"`
		Message string                 `json:"message"`
	}
	// Delete returns an integer in the legacy envelope.
	if request.Action == "delete_disabled_keys" {
		var response struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
		return response.Success, MultiKeyStatusResponse{}, response.Message
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	return response.Success, response.Data, response.Message
}

func TestMultiKeyEditsUseSnapshotAndPreserveOtherChannelFields(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := &model.Channel{Type: 1, Key: "short\nsecond-secret\nthird-secret", UsedQuota: 100, ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 3, MultiKeyStatusList: map[int]int{1: 2, 2: 3}, MultiKeyDisabledReason: map[int]string{1: "manual", 2: "auto"}, MultiKeyDisabledTime: map[int]int64{1: 10, 2: 20}}}
	require.NoError(t, model.DB.Create(channel).Error)
	success, snapshot, _ := multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "get_key_status", Page: 99, PageSize: 500})
	require.True(t, success)
	require.Equal(t, 200, snapshot.PageSize)
	require.Equal(t, 1, snapshot.Page)
	require.Equal(t, 1, snapshot.EnabledCount)
	require.NotContains(t, snapshot.Keys[0].KeyPreview, "short")
	index := 0
	success, _, _ = multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "delete_key", KeyIndex: &index, ExpectedRevision: snapshot.Revision})
	require.True(t, success)
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "second-secret\nthird-secret", stored.Key)
	require.Equal(t, map[int]int{0: 2, 1: 3}, stored.ChannelInfo.MultiKeyStatusList)
	require.Equal(t, map[int]int64{0: 10, 1: 20}, stored.ChannelInfo.MultiKeyDisabledTime)
	success, _, message := multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "disable_key", KeyIndex: &index, ExpectedRevision: snapshot.Revision})
	require.False(t, success)
	require.Contains(t, message, "changed")
	revision := model.ChannelMultiKeyRevision(stored)
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", stored.Id).Updates(map[string]any{"used_quota": 999, "name": "concurrent-name"}).Error)
	stored.ChannelInfo.MultiKeyStatusList[0] = 1
	require.NoError(t, model.CommitChannelMultiKeyEdit(stored, revision))
	current, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.EqualValues(t, 999, current.UsedQuota)
	require.Equal(t, "concurrent-name", current.Name)
	current.Key = "replacement"
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", current.Id).Update("key", current.Key).Error)
	require.ErrorContains(t, model.CommitChannelMultiKeyEdit(stored, revision), "changed")
}

func TestMultiKeyCleanupKeepsManualDisabledAndLastKey(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := &model.Channel{Type: 1, Key: "manual\nauto", ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyStatusList: map[int]int{0: 2, 1: 3}}}
	require.NoError(t, model.DB.Create(channel).Error)
	success, _, _ := multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "delete_disabled_keys"})
	require.True(t, success)
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "manual", stored.Key)
	index := 0
	success, _, _ = multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "delete_key", KeyIndex: &index})
	require.False(t, success)
	stored.ChannelInfo.MultiKeyStatusList[0] = 3
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", stored.Id).Update("channel_info", stored.ChannelInfo).Error)
	success, _, _ = multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "delete_disabled_keys"})
	require.False(t, success)
	stored, err = model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, "manual", stored.Key)
}

func TestMultiKeyConcurrentOperationsRetainEveryStatus(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := &model.Channel{Type: 1, Key: "one\ntwo\nthree\nfour", ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 4}}
	require.NoError(t, model.DB.Create(channel).Error)
	var workers sync.WaitGroup
	for i := 0; i < 4; i++ {
		workers.Go(func() {
			index := i
			success, _, _ := multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: "disable_key", KeyIndex: &index})
			require.True(t, success)
		})
	}
	workers.Wait()
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, map[int]int{0: 2, 1: 2, 2: 2, 3: 2}, stored.ChannelInfo.MultiKeyStatusList)
}

func TestMultiKeyExhaustionRecoveryPreservesExplicitManualDisable(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := &model.Channel{Type: 1, Key: "first\nsecond", Status: common.ChannelStatusEnabled,
		ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2}}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{ChannelId: channel.Id, Group: "default", Model: "test-model", Enabled: true}).Error)
	stored := func(status int, enabled bool) *model.Channel {
		current, err := model.GetChannelById(channel.Id, true)
		require.NoError(t, err)
		require.Equal(t, status, current.Status)
		var ability model.Ability
		require.NoError(t, model.DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
		require.Equal(t, enabled, ability.Enabled)
		return current
	}
	mutate := func(action string) {
		success, _, message := multiKeyRequest(t, MultiKeyManageRequest{ChannelId: channel.Id, Action: action})
		require.True(t, success, message)
	}
	mutate("disable_all_keys")
	current := stored(common.ChannelStatusManuallyDisabled, false)
	require.Equal(t, model.ChannelStatusReasonAllKeysDisabled, current.GetOtherInfo()["status_reason"])
	mutate("enable_all_keys")
	stored(common.ChannelStatusEnabled, true)
	mutate("disable_all_keys")
	require.True(t, model.UpdateChannelStatus(channel.Id, "", common.ChannelStatusManuallyDisabled, "manual operation"))
	mutate("enable_all_keys")
	current = stored(common.ChannelStatusManuallyDisabled, false)
	require.Equal(t, "manual operation", current.GetOtherInfo()["status_reason"])
}
