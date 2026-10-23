package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTokenAutoGroupsContextDoesNotBroadenInvalidSnapshots(t *testing.T) {
	originalGlobal := setting.AutoGroups2JsonString()
	originalUsable := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalGlobal))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsable))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
	for _, tc := range []struct {
		name, stored string
		want         []string
		present      bool
	}{
		{"inherit", "", []string{"default", "vip"}, false},
		{"legacy empty snapshot", `[]`, []string{"default", "vip"}, false},
		{"snapshot sorted by billing multiplier", `["vip","default"]`, []string{"default", "vip"}, true},
		{"revoked snapshot", `["removed"]`, []string{}, true},
		{"malformed snapshot", `{`, []string{}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			token := &model.Token{Group: "auto", AutoGroups: tc.stored, CrossGroupRetry: true}
			require.NoError(t, SetupContextForToken(c, token))
			_, present := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
			require.Equal(t, tc.present, present)
			require.True(t, common.GetContextKeyBool(c, constant.ContextKeyTokenCrossGroupRetry))
			require.Equal(t, tc.want, service.GetRequestAutoGroups(c, "default"))
		})
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.NoError(t, SetupContextForToken(c, &model.Token{Group: "auto", AutoGroups: `["vip","default"]`}))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
	require.Equal(t, []string{"default"}, service.GetRequestAutoGroups(c, "default"), "current permissions must be checked after authentication too")
}
