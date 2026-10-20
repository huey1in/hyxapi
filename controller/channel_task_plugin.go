package controller

import (
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"slices"
	"strings"
)

const maxTaskExtendPluginKeys = 32

func usesTaskPluginDefaultBaseURL(channel *model.Channel) bool {
	return channel != nil && channel.Type == constant.ChannelTypeTaskPlugin &&
		(channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "")
}

func validateTaskPluginChannel(channel *model.Channel) error {
	if channel.Type == constant.ChannelTypeTaskPlugin {
		pluginKey := strings.TrimSpace(channel.GetSetting().TaskPluginKey)
		if pluginKey == "" {
			return fmt.Errorf("task plugin key is required")
		}
		if len(pluginKey) > 30 {
			return fmt.Errorf("task plugin key must not exceed 30 characters")
		}
		plugin, ok := jsplugin.DefaultRegistry.Get(pluginKey)
		if !ok {
			return fmt.Errorf("task plugin %q is not registered", pluginKey)
		}
		if channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
			// The plugin default is persisted onto the channel instead of being
			// resolved per request, so the destination host stays an auditable
			// channel property that only an administrator edit can change.
			if plugin.Meta.BaseURL == "" {
				return fmt.Errorf("base URL is required for task plugin channels")
			}
			defaultBaseURL := plugin.Meta.BaseURL
			channel.BaseURL = &defaultBaseURL
		}
	}

	setting := channel.GetSetting()
	if channel.Type != constant.ChannelTypeNewAPI && len(setting.TaskExtendPluginKeys) > 0 {
		return fmt.Errorf("task_extend_plugin_keys is only supported on New API channels")
	}
	if channel.Type == constant.ChannelTypeNewAPI {
		if len(setting.TaskExtendPluginKeys) > maxTaskExtendPluginKeys {
			return fmt.Errorf("task_extend_plugin_keys must not exceed %d plugins", maxTaskExtendPluginKeys)
		}
		// The single key stays valid on a New API channel, so both bindings are
		// checked as one set.
		keys := setting.TaskExtendPluginKeys
		if setting.TaskPluginKey != "" {
			keys = append([]string{setting.TaskPluginKey}, keys...)
		}
		bound := make(map[string]struct{}, len(keys))
		for _, key := range keys {
			if key == "" || key != strings.TrimSpace(key) {
				return fmt.Errorf("task plugin key %q is invalid", key)
			}
			if len(key) > 30 {
				return fmt.Errorf("task plugin key must not exceed 30 characters")
			}
			if _, duplicate := bound[key]; duplicate {
				return fmt.Errorf("task plugin %q is bound more than once", key)
			}
			plugin, ok := jsplugin.DefaultRegistry.Get(key)
			if !ok {
				return fmt.Errorf("task plugin %q is not registered", key)
			}
			if !plugin.Meta.SupportsUpstream(jsplugin.UpstreamKindNewAPI) {
				return fmt.Errorf("task plugin %q does not support a New API upstream and cannot be bound to a New API channel", key)
			}
			bound[key] = struct{}{}
		}
	}

	return nil
}
func requireTaskPluginBind(c *gin.Context, channel, origin *model.Channel) bool {
	if channel == nil {
		return true
	}
	newKeys := channel.GetSetting().TaskPluginBindings()
	requiresBind := channel.Type == constant.ChannelTypeTaskPlugin
	if origin == nil {
		requiresBind = requiresBind || len(newKeys) > 0
	} else if channel.Setting != nil {
		requiresBind = requiresBind || !slices.Equal(newKeys, origin.GetSetting().TaskPluginBindings())
	}
	if requiresBind && !middleware.HasPermission(c, authz.TaskPluginBind) {
		common.ApiErrorMsg(c, "task plugin channels require the task_plugin.bind permission")
		return false
	}
	return true
}
