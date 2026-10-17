package service

import (
	"errors"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type RetryParam struct {
	Ctx               *gin.Context // kept for API compatibility with callers
	TokenGroup        string
	ModelName         string
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
		if id := param.Ctx.GetInt("responses_ws_channel_id"); id > 0 {
			channel, err := model.CacheGetChannel(id)
			if err != nil || !model.SupportsResponsesWebSocket(channel, param.ModelName) || !model.IsChannelEnabledForGroupModel(param.TokenGroup, param.ModelName, id) {
				return nil, param.TokenGroup, errors.New("the WebSocket channel is no longer available for this group and model")
			}
			return channel, param.TokenGroup, nil
		}
		channel, err := model.GetResponsesWebSocketChannel(param.TokenGroup, param.ModelName, param.ExcludeChannels)
		return channel, param.TokenGroup, err
	}
	channel, err := model.GetRandomSatisfiedChannel(param.TokenGroup, param.ModelName, param.GetRetry(), param.ExcludeChannels)
	if err != nil {
		return nil, param.TokenGroup, err
	}
	return channel, param.TokenGroup, nil
}
