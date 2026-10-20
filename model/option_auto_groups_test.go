package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestAutoGroupsOptionsValidateBeforePersistenceAndApply(t *testing.T) {
	originalGlobal := setting.AutoGroups2JsonString()
	originalDefault := setting.DefaultUseAutoGroup
	originalMax := setting.GetMaxTokenAutoGroups()
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalGlobal))
		setting.DefaultUseAutoGroup = originalDefault
		require.NoError(t, setting.UpdateMaxTokenAutoGroups(strconv.Itoa(originalMax)))
		common.OptionMap = originalMap
	})
	for _, value := range []string{"0", "-1", "1.5", "invalid"} {
		require.Error(t, validateOptionValue("MaxTokenAutoGroups", value))
	}
	require.Error(t, validateOptionValue("AutoGroups", `{"default":1}`))
	require.NoError(t, updateOptionMap("AutoGroups", `["vip","default"]`))
	require.NoError(t, updateOptionMap("MaxTokenAutoGroups", "2"))
	require.NoError(t, updateOptionMap("DefaultUseAutoGroup", "true"))
	require.Equal(t, []string{"vip", "default"}, setting.GetAutoGroups())
	require.Equal(t, 2, setting.GetMaxTokenAutoGroups())
	require.True(t, setting.DefaultUseAutoGroup)
	require.Error(t, setting.UpdateAutoGroupsByJsonString(`{`))
	require.Equal(t, []string{"vip", "default"}, setting.GetAutoGroups(), "invalid JSON must preserve the working list")
	copy := setting.GetAutoGroups()
	copy[0] = "changed"
	require.Equal(t, "vip", setting.GetAutoGroups()[0])
}
