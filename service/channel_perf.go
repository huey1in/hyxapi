package service

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	perfWindowSeconds = 300 // 5 minutes per bucket
	perfLatencyLow    = 5000
	perfLatencyHigh   = 30000
	perfLatencyMinFactor = 0.3
)

type perfBucket struct {
	successCount  int64
	errorCount    int64
	totalLatencyMs int64
	windowStart   int64
}

type channelPerf struct {
	mu      sync.Mutex
	current perfBucket
	prev    perfBucket
}

var perfStore sync.Map // map[int]*channelPerf

func getOrCreatePerf(channelId int) *channelPerf {
	if v, ok := perfStore.Load(channelId); ok {
		return v.(*channelPerf)
	}
	p := &channelPerf{}
	now := time.Now().Unix()
	p.current.windowStart = now
	p.prev.windowStart = now - perfWindowSeconds
	actual, _ := perfStore.LoadOrStore(channelId, p)
	return actual.(*channelPerf)
}

func (p *channelPerf) rotate() {
	now := time.Now().Unix()
	elapsed := now - p.current.windowStart
	if elapsed >= perfWindowSeconds {
		p.prev = p.current
		p.current = perfBucket{windowStart: now}
	}
}

func RecordChannelSuccess(channelId int, latencyMs int64) {
	p := getOrCreatePerf(channelId)
	p.mu.Lock()
	p.rotate()
	atomic.AddInt64(&p.current.successCount, 1)
	atomic.AddInt64(&p.current.totalLatencyMs, latencyMs)
	p.mu.Unlock()
}

func RecordChannelError(channelId int) {
	p := getOrCreatePerf(channelId)
	p.mu.Lock()
	p.rotate()
	atomic.AddInt64(&p.current.errorCount, 1)
	p.mu.Unlock()
}

func GetChannelPerfScore(channelId int) float64 {
	d := GetChannelPerfDetail(channelId)
	return d.Score
}

type ChannelPerfDetail struct {
	Score      float64 `json:"score"`
	Success    int64   `json:"success"`
	Errors     int64   `json:"errors"`
	AvgLatency int64   `json:"avg_latency"`
}

func GetChannelPerfDetail(channelId int) ChannelPerfDetail {
	v, ok := perfStore.Load(channelId)
	if !ok {
		return ChannelPerfDetail{Score: 1.0}
	}
	p := v.(*channelPerf)
	p.mu.Lock()
	p.rotate()

	now := time.Now().Unix()
	var totalSuccess, totalErrors, totalLatency int64

	if now-p.prev.windowStart < 2*perfWindowSeconds {
		totalSuccess += p.prev.successCount
		totalErrors += p.prev.errorCount
		totalLatency += p.prev.totalLatencyMs
	}
	totalSuccess += p.current.successCount
	totalErrors += p.current.errorCount
	totalLatency += p.current.totalLatencyMs
	p.mu.Unlock()

	total := totalSuccess + totalErrors
	if total == 0 {
		return ChannelPerfDetail{Score: 1.0}
	}

	errorRate := float64(totalErrors) / float64(total)

	var avgLatency int64
	if totalSuccess > 0 {
		avgLatency = totalLatency / totalSuccess
	}

	var score float64
	if errorRate > 0.8 {
		score = 0.0
	} else {
		var latencyFactor float64 = 1.0
		if totalSuccess > 0 {
			avg := float64(totalLatency) / float64(totalSuccess)
			if avg > float64(perfLatencyHigh) {
				latencyFactor = perfLatencyMinFactor
			} else if avg > float64(perfLatencyLow) {
				latencyFactor = 1.0 - (1.0-perfLatencyMinFactor)*(avg-float64(perfLatencyLow))/float64(perfLatencyHigh-perfLatencyLow)
			}
		}
		score = (1.0 - errorRate) * latencyFactor
	}

	return ChannelPerfDetail{
		Score:      score,
		Success:    totalSuccess,
		Errors:     totalErrors,
		AvgLatency: avgLatency,
	}
}

func init() {
	model.ChannelPerfScoreFunc = GetChannelPerfScore
}
