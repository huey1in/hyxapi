package service

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

var (
	modelHealthOnce   sync.Once
	modelHealthTicker *time.Ticker
	modelHealthMu     sync.Mutex
)

// 平均延迟超过该阈值（毫秒）视为「降级」(degraded)
const slowLatencyMs int64 = 30000

func StartModelHealthTask() {
	modelHealthOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			setting := operation_setting.GetMonitorSetting()
			if !setting.ModelHealthEnabled {
				common.SysLog("model health check is disabled")
				return
			}
			interval := time.Duration(setting.ModelHealthIntervalMinutes * float64(time.Minute))
			if interval < 5*time.Second {
				interval = 1 * time.Minute
			}
			common.SysLog(fmt.Sprintf("model health task started (passive/log-based): interval=%s", interval))

			modelHealthMu.Lock()
			modelHealthTicker = time.NewTicker(interval)
			modelHealthMu.Unlock()

			// Warm-start: rebuild ~60 buckets of history (bucket size = interval) from
			// recent logs so the timeline isn't empty after a restart.
			backfillModelHealth(interval, 60)

			// first run after 10s delay
			time.Sleep(10 * time.Second)
			runModelHealthAggregation(interval)
			model.CleanupOldHealthRecords()
			for range modelHealthTicker.C {
				setting := operation_setting.GetMonitorSetting()
				if !setting.ModelHealthEnabled {
					continue
				}
				runModelHealthAggregation(interval)
				model.CleanupOldHealthRecords()
			}
		})
	})
}

// uniqueEnabledPairs returns the de-duplicated set of enabled model+group pairs.
func uniqueEnabledPairs() []healthPair {
	enabledAbilities := model.GetEnabledAbilities()
	seen := make(map[healthPair]bool)
	var pairs []healthPair
	for _, a := range enabledAbilities {
		k := healthPair{a.Model, a.Group}
		if !seen[k] {
			seen[k] = true
			pairs = append(pairs, k)
		}
	}
	return pairs
}

type healthPair struct{ model, group string }

// deriveHealthStatus maps aggregated log stats to a health status string.
func deriveHealthStatus(stat *model.ModelGroupLogStat) string {
	switch {
	case stat.Total == 0:
		// No traffic this window — record idle so the timeline stays aligned
		return "idle"
	case stat.Errors*2 >= stat.Total:
		// 错误率 >= 50%
		return "down"
	case stat.Errors*10 >= stat.Total || (stat.AvgLatencyMs > 0 && stat.AvgLatencyMs > slowLatencyMs):
		// 错误率 >= 10% 或平均延迟过高
		return "degraded"
	default:
		return "up"
	}
}

// backfillModelHealth reconstructs per-bucket history from recent logs so the
// chart shows data immediately instead of after a full window of ticking.
func backfillModelHealth(interval time.Duration, buckets int) {
	pairs := uniqueEnabledPairs()
	if len(pairs) == 0 {
		return
	}
	bucketSec := int64(interval.Seconds())
	if bucketSec < 1 {
		bucketSec = 60
	}
	now := time.Now().Unix()
	start := now - int64(buckets)*bucketSec
	for _, pp := range pairs {
		for i := 0; i < buckets; i++ {
			s := start + int64(i)*bucketSec
			e := s + bucketSec
			stat, err := model.GetModelGroupLogStatRange(pp.model, pp.group, s, e)
			if err != nil {
				continue
			}
			model.RecordModelHealth(pp.model, pp.group, model.ModelHealthRecord{
				CheckedAt:    e,
				Total:        stat.Total,
				Errors:       stat.Errors,
				Latency:      stat.AvgLatencyMs,
				PromptTokens: stat.PromptTokens,
				CacheTokens:  stat.CacheTokens,
				Status:       deriveHealthStatus(stat),
			})
		}
	}
}

// runModelHealthAggregation queries the log table for each enabled model+group
// within the last interval window and derives health status from real traffic.
func runModelHealthAggregation(interval time.Duration) {
	pairs := uniqueEnabledPairs()
	if len(pairs) == 0 {
		return
	}

	// Time window: one interval back (at least 5s).
	window := interval
	if window < 5*time.Second {
		window = 5 * time.Second
	}
	since := time.Now().Add(-window).Unix()

	// Query log stats for each pair
	for _, pp := range pairs {
		stat, err := model.GetModelGroupLogStat(pp.model, pp.group, since)
		if err != nil {
			continue
		}
		model.RecordModelHealth(pp.model, pp.group, model.ModelHealthRecord{
			CheckedAt:    time.Now().Unix(),
			Total:        stat.Total,
			Errors:       stat.Errors,
			Latency:      stat.AvgLatencyMs,
			PromptTokens: stat.PromptTokens,
			CacheTokens:  stat.CacheTokens,
			Status:       deriveHealthStatus(stat),
		})
	}
}
