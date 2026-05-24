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
			if interval < 1*time.Minute {
				interval = 5 * time.Minute
			}
			common.SysLog(fmt.Sprintf("model health task started (passive/log-based): interval=%s", interval))

			modelHealthMu.Lock()
			modelHealthTicker = time.NewTicker(interval)
			modelHealthMu.Unlock()

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

// runModelHealthAggregation queries the log table for each enabled model+group
// within the last interval window and derives health status from real traffic.
func runModelHealthAggregation(interval time.Duration) {
	// Get all enabled model+group pairs
	enabledAbilities := model.GetEnabledAbilities()
	if len(enabledAbilities) == 0 {
		return
	}

	// De-duplicate to unique model+group pairs
	type pair struct{ model, group string }
	seen := make(map[pair]bool)
	var pairs []pair
	for _, a := range enabledAbilities {
		k := pair{a.Model, a.Group}
		if !seen[k] {
			seen[k] = true
			pairs = append(pairs, k)
		}
	}

	// Time window: look back by 1x interval (or at least 5 min)
	window := interval
	if window < 5*time.Minute {
		window = 5 * time.Minute
	}
	since := time.Now().Add(-window).Unix()

	// Query log stats for each pair
	for _, pp := range pairs {
		stat, err := model.GetModelGroupLogStat(pp.model, pp.group, since)
		if err != nil {
			continue
		}

		rec := model.ModelHealthRecord{
			CheckedAt: time.Now().Unix(),
		}

		if stat.Total == 0 {
			// No traffic in this window — keep previous status, don't record
			continue
		}

		if stat.Errors == stat.Total {
			// All requests failed
			rec.Status = "down"
			rec.Latency = stat.AvgLatencyMs
		} else {
			rec.Status = "up"
			rec.Latency = stat.AvgLatencyMs
		}
		model.RecordModelHealth(pp.model, pp.group, rec)
	}
}
