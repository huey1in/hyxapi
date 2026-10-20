package service

import (
	"errors"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type RetryParam struct {
	Ctx               *gin.Context // kept for API compatibility with callers
	TokenGroup        string
	ModelName         string
	RequestPath       string
	Retry             *int
	resetNextTry      bool
	ExcludeChannels   []int
	TokenGroups       []string
	GroupIndex        int
	SwitchStatusCodes map[int]struct{}
	SwitchRetryCount  int
	matchedFailures   int
}

func (p *RetryParam) AdvanceGroup(statusCode int) bool {
	if p == nil {
		return false
	}
	if _, ok := p.SwitchStatusCodes[statusCode]; !ok {
		p.matchedFailures = 0
		return false
	}
	p.matchedFailures++
	if p.matchedFailures <= p.SwitchRetryCount || p.GroupIndex+1 >= len(p.TokenGroups) {
		return false
	}
	p.GroupIndex++
	p.matchedFailures = 0
	p.TokenGroup = p.TokenGroups[p.GroupIndex]
	p.ExcludeChannels = nil
	p.SetRetry(0)
	p.ResetRetryNextTry()
	return true
}

func (p *RetryParam) ShouldRetryCurrentGroup(statusCode int) bool {
	if p == nil {
		return false
	}
	_, configured := p.SwitchStatusCodes[statusCode]
	return configured && p.matchedFailures > 0 && p.matchedFailures <= p.SwitchRetryCount
}

func (p *RetryParam) MaxRetries(globalRetries int) int {
	if p != nil && p.SwitchRetryCount > globalRetries {
		return p.SwitchRetryCount
	}
	return globalRetries
}

func (p *RetryParam) GetRetry() int {
	if p.Retry == nil {
		return 0
	}
	return *p.Retry
}

func (p *RetryParam) SetRetry(retry int) {
	p.Retry = &retry
}

func (p *RetryParam) IncreaseRetry() {
	if p.resetNextTry {
		p.resetNextTry = false
		return
	}
	if p.Retry == nil {
		p.Retry = new(int)
	}
	*p.Retry++
}

func (p *RetryParam) ResetRetryNextTry() {
	p.resetNextTry = true
}

func CacheGetRandomSatisfiedChannel(param *RetryParam) (*model.Channel, string, error) {
	if param.Ctx != nil && param.Ctx.GetBool("responses_websocket") {
		groups := []string{param.TokenGroup}
		if param.TokenGroup == "auto" {
			groups = GetRequestAutoGroups(param.Ctx, common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup))
		}
		if id := param.Ctx.GetInt("responses_ws_channel_id"); id > 0 {
			channel, err := model.CacheGetChannel(id)
			if err == nil && model.SupportsResponsesWebSocket(channel, param.ModelName) {
				for _, group := range groups {
					if model.IsChannelEnabledForGroupModel(group, param.ModelName, id) {
						return channel, group, nil
					}
				}
			}
			return nil, param.TokenGroup, errors.New("the WebSocket channel is no longer available for this group and model")
		}
		for _, group := range groups {
			channel, err := model.GetResponsesWebSocketChannel(group, param.ModelName, param.ExcludeChannels)
			if err != nil {
				return nil, group, err
			}
			if channel != nil {
				if param.TokenGroup == "auto" {
					common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, group)
				}
				return channel, group, nil
			}
		}
		return nil, param.TokenGroup, nil
	}
	var channel *model.Channel
	var err error
	selectGroup := param.TokenGroup
	var userGroup string
	if param.Ctx != nil {
		userGroup = common.GetContextKeyString(param.Ctx, constant.ContextKeyUserGroup)
	}
	filters := GetChannelConstraints(param.Ctx).Filters

	if param.TokenGroup == "auto" {
		autoGroups := GetRequestAutoGroups(param.Ctx, userGroup)
		if len(autoGroups) == 0 {
			return nil, selectGroup, errors.New("auto groups is not enabled")
		}

		// startGroupIndex: the group index to start searching from
		// startGroupIndex: 开始搜索的分组索引
		startGroupIndex := 0
		crossGroupRetry := common.GetContextKeyBool(param.Ctx, constant.ContextKeyTokenCrossGroupRetry)

		if lastGroupIndex, exists := common.GetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex); exists {
			if idx, ok := lastGroupIndex.(int); ok {
				startGroupIndex = idx
			}
		}

		for i := startGroupIndex; i < len(autoGroups); i++ {
			autoGroup := autoGroups[i]
			// Calculate priorityRetry for current group
			// 计算当前分组的 priorityRetry
			priorityRetry := param.GetRetry()
			// If moved to a new group, reset priorityRetry and update startRetryIndex
			// 如果切换到新分组，重置 priorityRetry 并更新 startRetryIndex
			if i > startGroupIndex {
				priorityRetry = 0
			}
			logger.LogDebug(param.Ctx, "Auto selecting group: %s, priorityRetry: %d", autoGroup, priorityRetry)

			channel, _ = model.GetRandomSatisfiedChannel(
				autoGroup,
				param.ModelName,
				priorityRetry,
				param.ExcludeChannels,
				filters,
			)
			if channel == nil {
				// Current group has no available channel for this model, try next group
				// 当前分组没有该模型的可用渠道，尝试下一个分组
				logger.LogDebug(param.Ctx, "No available channel in group %s for model %s at priorityRetry %d, trying next group", autoGroup, param.ModelName, priorityRetry)
				// 重置状态以尝试下一个分组
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupRetryIndex, 0)
				// Reset retry counter so outer loop can continue for next group
				// 重置重试计数器，以便外层循环可以为下一个分组继续
				param.SetRetry(0)
				continue
			}
			common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroup, autoGroup)
			selectGroup = autoGroup
			logger.LogDebug(param.Ctx, "Auto selected group: %s", autoGroup)

			// Prepare state for next retry
			// 为下一次重试准备状态
			if crossGroupRetry && priorityRetry >= common.RetryTimes {
				// Current group has exhausted all retries, prepare to switch to next group
				// This request still uses current group, but next retry will use next group
				// 当前分组已用完所有重试次数，准备切换到下一个分组
				// 本次请求仍使用当前分组，但下次重试将使用下一个分组
				logger.LogDebug(param.Ctx, "Current group %s retries exhausted (priorityRetry=%d >= RetryTimes=%d), preparing switch to next group for next retry", autoGroup, priorityRetry, common.RetryTimes)
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i+1)
				// Reset retry counter so outer loop can continue for next group
				// 重置重试计数器，以便外层循环可以为下一个分组继续
				param.SetRetry(0)
				param.ResetRetryNextTry()
			} else {
				// Stay in current group, save current state
				// 保持在当前分组，保存当前状态
				common.SetContextKey(param.Ctx, constant.ContextKeyAutoGroupIndex, i)
			}
			break
		}
	} else {
		channel, err = model.GetRandomSatisfiedChannel(
			param.TokenGroup,
			param.ModelName,
			param.GetRetry(),
			param.ExcludeChannels,
			filters,
		)
		if err != nil {
			return nil, param.TokenGroup, err
		}
	}
	return channel, selectGroup, nil
}
