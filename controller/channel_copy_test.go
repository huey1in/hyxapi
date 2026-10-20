package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCopyChannelRetainsCredentialsAndExplicitCounterChoice(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	channel := &model.Channel{Type: 1, Key: "copy-fixture-secret", Name: "source", Models: "gpt-4o", Group: "default", Status: 1, Balance: 12.5, UsedQuota: 7654, TestTime: 123, ResponseTime: 4}
	require.NoError(t, channel.Insert())
	copy := func(suffix, reset string) int {
		t.Helper()
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Set("id", 1)
		c.Set("role", common.RoleRootUser)
		c.Params = gin.Params{{Key: "id", Value: strconv.Itoa(channel.Id)}}
		c.Request = httptest.NewRequest(http.MethodPost, "/copy?suffix="+url.QueryEscape(suffix)+"&reset_balance="+reset, nil)
		CopyChannel(c)
		var envelope struct {
			Success bool `json:"success"`
			Data    struct {
				ID int `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
		if reset == "invalid" {
			require.False(t, envelope.Success)
			return 0
		}
		require.True(t, envelope.Success, recorder.Body.String())
		require.NotContains(t, recorder.Body.String(), channel.Key)
		return envelope.Data.ID
	}
	resetID := copy(" &复制/one", "true")
	reset, err := model.GetChannelById(resetID, true)
	require.NoError(t, err)
	require.Equal(t, "source &复制/one", reset.Name)
	require.Equal(t, channel.Key, reset.Key)
	require.Zero(t, reset.Balance)
	require.Zero(t, reset.UsedQuota)
	require.Zero(t, reset.TestTime)
	require.Zero(t, reset.ResponseTime)
	var abilities []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ?", resetID).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	keepID := copy("_keep", "false")
	keep, err := model.GetChannelById(keepID, true)
	require.NoError(t, err)
	require.Equal(t, channel.Balance, keep.Balance)
	require.Equal(t, channel.UsedQuota, keep.UsedQuota)
	copy("_invalid", "invalid")
	var count int64
	require.NoError(t, model.DB.Model(&model.Channel{}).Count(&count).Error)
	require.EqualValues(t, 3, count)
}
