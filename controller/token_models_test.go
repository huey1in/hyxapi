package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetTokenModelsUsesOwnedTokenPolicyWithoutRecordingUsage(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Token{}))
	configureTokenAutoGroupsTest(t, "5", `["default","vip"]`)
	previousSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = previousSelfUse })
	user := model.User{Id: 73191, Username: "cc-switch-owner", Group: "default", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	for index, name := range []string{"cc-default", "cc-vip", "gpt-5.4@effort:high", "cc-disabled", "cc-revoked", "cc-unpriced"} {
		group := "default"
		if index == 1 {
			group = "vip"
		} else if index == 4 {
			group = "revoked"
		}
		require.NoError(t, db.Create(&model.Ability{Group: group, Model: name, ChannelId: index + 1, Enabled: index != 3}).Error)
		if index != 5 {
			require.NoError(t, model.SaveModelPricing(&model.ModelPricing{ModelName: name, Enabled: true, InputPrice: 1}))
		}
	}
	request := func(tokenID, userID int) (bool, []dto.OpenAIModels, string) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/token/"+stringInt(tokenID)+"/models", nil)
		c.Params = gin.Params{{Key: "id", Value: stringInt(tokenID)}}
		c.Set("id", userID)
		GetTokenModels(c)
		var response struct {
			Success bool               `json:"success"`
			Data    []dto.OpenAIModels `json:"data"`
		}
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &response))
		return response.Success, response.Data, w.Body.String()
	}
	for index, test := range []struct {
		name, group, auto, limit string
		limited                  bool
		want                     []string
	}{
		{name: "manual group", group: "vip", want: []string{"cc-vip"}},
		{name: "ordered manual groups", group: `["default","vip"]`, want: []string{"cc-default", "cc-vip", "gpt-5.4@effort:high"}},
		{name: "routing model limit", group: "default", limited: true, limit: "gpt-5.4,cc-disabled,cc-vip", want: []string{"gpt-5.4@effort:high"}},
		{name: "empty model grant", group: "default", limited: true, want: []string{}},
		{name: "inherited auto", group: "auto", want: []string{"cc-default", "cc-vip", "gpt-5.4@effort:high"}},
		{name: "custom auto", group: "auto", auto: `["vip"]`, want: []string{"cc-vip"}},
		{name: "revoked custom auto", group: "auto", auto: `["revoked"]`, want: []string{}},
		{name: "revoked manual group", group: "revoked", want: []string{}},
	} {
		t.Run(test.name, func(t *testing.T) {
			token := model.Token{UserId: user.Id, Name: test.name, Key: strings.Repeat("k", 40) + stringInt(index), Status: common.TokenStatusEnabled,
				Group: test.group, AutoGroups: test.auto, ModelLimitsEnabled: test.limited, ModelLimits: test.limit, AccessedTime: 0, RemainQuota: 123}
			require.NoError(t, db.Create(&token).Error)
			success, rows, body := request(token.Id, user.Id)
			require.True(t, success, body)
			names := make([]string, 0, len(rows))
			for _, row := range rows {
				names = append(names, row.Id)
			}
			require.ElementsMatch(t, test.want, names)
			require.NotContains(t, body, token.Key)
			var stored model.Token
			require.NoError(t, db.First(&stored, token.Id).Error)
			require.Zero(t, stored.AccessedTime)
			require.Equal(t, 123, stored.RemainQuota)
			success, _, _ = request(token.Id, user.Id+1)
			require.False(t, success, "another user cannot discover this token's models")
			require.NoError(t, db.Delete(&stored).Error)
			success, _, _ = request(token.Id, user.Id)
			require.False(t, success, "deleted tokens cannot be exported")
		})
	}
}
