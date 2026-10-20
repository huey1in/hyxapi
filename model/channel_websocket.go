package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/wsmanager"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm/clause"
	"reflect"
)

// GetResponsesWebSocketChannel filters native support before choosing the
// highest available priority. HTTP retry exclusions are only advisory and
// cannot safely be used to filter out unsupported WebSocket channels.
func GetResponsesWebSocketChannel(group, modelName string, excluded []int) (*Channel, error) {
	var ids []int
	findIDs := func(name string) error {
		return DB.Model(&Ability{}).Where(clause.Eq{Column: "group", Value: group}).Where("model = ? AND enabled = ?", name, true).Distinct("channel_id").Pluck("channel_id", &ids).Error
	}
	if err := findIDs(modelName); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		if normalized := ratio_setting.RoutingMatchModelName(modelName); normalized != modelName {
			if err := findIDs(normalized); err != nil {
				return nil, err
			}
		}
	}
	if len(ids) == 0 {
		return nil, nil
	}
	var channels []*Channel
	query := DB.Where("id IN ?", ids)
	if len(excluded) > 0 {
		query = query.Where("id NOT IN ?", excluded)
	}
	if err := query.Order("COALESCE(priority, 0) DESC, id DESC").Find(&channels).Error; err != nil {
		return nil, err
	}
	var candidates []*Channel
	for _, channel := range channels {
		if !SupportsResponsesWebSocket(channel, modelName) {
			continue
		}
		if len(candidates) > 0 && channel.GetPriority() < candidates[0].GetPriority() {
			break
		}
		candidates = append(candidates, channel)
	}
	if len(candidates) == 0 {
		return nil, nil
	}
	weights := make([]int, len(candidates))
	total := 0
	for i, candidate := range candidates {
		weight := candidate.GetWeight() + 10
		if ChannelPerfScoreFunc != nil {
			score := ChannelPerfScoreFunc(candidate.Id)
			weight = max(0, int(float64(weight)*score))
		}
		weights[i] = weight
		total += weight
	}
	if total == 0 {
		return candidates[common.GetRandomInt(len(candidates))], nil
	}
	selection := common.GetRandomInt(total)
	for i, candidate := range candidates {
		selection -= weights[i]
		if selection < 0 {
			return candidate, nil
		}
	}
	return candidates[len(candidates)-1], nil
}

// SupportsResponsesWebSocket excludes converters: the connection must carry native Responses events.
func SupportsResponsesWebSocket(channel *Channel, modelName string) bool {
	if channel == nil || channel.Status != common.ChannelStatusEnabled || !channel.GetSetting().ResponsesWebSocketEnabled {
		return false
	}
	switch channel.Type {
	case constant.ChannelTypeOpenAI, constant.ChannelTypeNewAPI, constant.ChannelTypeSub2API:
		return true
	case constant.ChannelTypeAdvancedCustom, constant.ChannelTypeVLLM, constant.ChannelTypeSGLang:
		route, ok := channel.GetOtherSettings().AdvancedCustom.MatchPathForModel("/v1/responses", modelName)
		return ok && route.IsNative()
	}
	return false
}

func closeChangedChannelWebSockets(before, after *Channel) {
	if before == nil || after == nil {
		return
	}
	if before.Status != after.Status || before.Key != after.Key || before.Type != after.Type || before.GetBaseURL() != after.GetBaseURL() ||
		!reflect.DeepEqual(before.GetSetting(), after.GetSetting()) || !reflect.DeepEqual(before.GetHeaderOverride(), after.GetHeaderOverride()) ||
		!reflect.DeepEqual(before.GetOtherSettings().AdvancedCustom, after.GetOtherSettings().AdvancedCustom) ||
		!reflect.DeepEqual(before.ChannelInfo.MultiKeyStatusList, after.ChannelInfo.MultiKeyStatusList) {
		wsmanager.CloseChannelsAndBroadcast([]int{after.Id}, "channel connection settings changed")
	}
}
