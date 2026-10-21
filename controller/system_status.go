package controller

import (
	"context"
	"net/http"
	"runtime"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetSystemStatus(c *gin.Context) {
	sysStatus := common.GetSystemStatus()
	diskInfo := common.GetDiskSpaceInfo()
	stats := middleware.GetStats()
	dcStats := common.GetDiskCacheStats()

	// Go runtime memory stats
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	var gcPauseAvg uint64
	if mem.NumGC > 0 {
		n := mem.NumGC
		if n > 256 {
			n = 256
		}
		var total uint64
		for i := uint32(0); i < n; i++ {
			total += mem.PauseNs[(mem.NumGC-1-i+256)%256]
		}
		gcPauseAvg = total / uint64(n) / 1000
	}

	// Database pool stats
	dbStats := gin.H{}
	if sqlDB, err := model.DB.DB(); err == nil {
		s := sqlDB.Stats()
		dbStats = gin.H{
			"max_open":         s.MaxOpenConnections,
			"open":             s.OpenConnections,
			"in_use":           s.InUse,
			"idle":             s.Idle,
			"wait_count":       s.WaitCount,
			"wait_duration_ms": s.WaitDuration.Milliseconds(),
		}
	}

	logDbStats := gin.H{}
	if logSqlDB, err := model.LOG_DB.DB(); err == nil {
		s := logSqlDB.Stats()
		logDbStats = gin.H{
			"max_open":         s.MaxOpenConnections,
			"open":             s.OpenConnections,
			"in_use":           s.InUse,
			"idle":             s.Idle,
			"wait_count":       s.WaitCount,
			"wait_duration_ms": s.WaitDuration.Milliseconds(),
		}
	}

	// Redis stats
	redisInfo := gin.H{"enabled": common.RedisEnabled}
	if common.RedisEnabled && common.RDB != nil {
		ps := common.RDB.PoolStats()
		redisInfo["total_conns"] = ps.TotalConns
		redisInfo["idle_conns"] = ps.IdleConns
		redisInfo["stale_conns"] = ps.StaleConns
		redisInfo["hits"] = ps.Hits
		redisInfo["misses"] = ps.Misses
		redisInfo["timeouts"] = ps.Timeouts
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		if dbSize, err := common.RDB.DBSize(ctx).Result(); err == nil {
			redisInfo["db_size"] = dbSize
		}
		cancel()
	}

	// Request stats — today + all time
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	windowStart := now.Add(-5 * time.Minute).Unix()
	todayStat, _ := model.SumUsedQuota(0, todayStart, 0, "", "", "", 0, "")
	totalStat, _ := model.SumUsedQuota(0, 0, 0, "", "", "", 0, "")
	requestHealth, _ := model.GetRequestHealthStat(windowStart, now.Unix())

	// Channel affinity cache
	affinityStats := service.GetChannelAffinityCacheStats()

	dbPressure := poolPressure(dbStats)
	logDbPressure := poolPressure(logDbStats)
	healthStatus := "ok"
	var healthWarnings []string
	if sysStatus.CPUUsage >= 90 || sysStatus.MemoryUsage >= 90 || sysStatus.DiskUsage >= 90 {
		healthStatus = "critical"
		healthWarnings = append(healthWarnings, "资源使用率过高")
	} else if sysStatus.CPUUsage >= 75 || sysStatus.MemoryUsage >= 75 || sysStatus.DiskUsage >= 75 {
		healthStatus = "warning"
		healthWarnings = append(healthWarnings, "资源使用率偏高")
	}
	if requestHealth.TotalRequests > 0 && requestHealth.SuccessRate < 95 {
		if requestHealth.SuccessRate < 90 {
			healthStatus = "critical"
		} else if healthStatus == "ok" {
			healthStatus = "warning"
		}
		healthWarnings = append(healthWarnings, "近5分钟请求成功率偏低")
	}
	if dbPressure >= 80 || logDbPressure >= 80 {
		if healthStatus == "ok" {
			healthStatus = "warning"
		}
		healthWarnings = append(healthWarnings, "数据库连接池压力偏高")
	}
	if !common.RedisEnabled {
		healthWarnings = append(healthWarnings, "Redis 未启用")
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"system": gin.H{
				"version":            common.Version,
				"uptime_seconds":     time.Now().Unix() - common.StartTime,
				"go_version":         runtime.Version(),
				"goroutines":         runtime.NumGoroutine(),
				"active_connections": stats.ActiveConnections,
			},
			"health": gin.H{
				"status":          healthStatus,
				"warnings":        healthWarnings,
				"window_seconds":  300,
				"db_pressure":     dbPressure,
				"log_db_pressure": logDbPressure,
			},
			"resources": gin.H{
				"cpu_usage":    sysStatus.CPUUsage,
				"memory_usage": sysStatus.MemoryUsage,
				"disk_usage":   sysStatus.DiskUsage,
				"disk_total":   diskInfo.Total,
				"disk_used":    diskInfo.Used,
				"disk_free":    diskInfo.Free,
			},
			"runtime": gin.H{
				"heap_alloc":      mem.HeapAlloc,
				"heap_sys":        mem.HeapSys,
				"heap_idle":       mem.HeapIdle,
				"heap_inuse":      mem.HeapInuse,
				"stack_inuse":     mem.StackInuse,
				"gc_sys":          mem.GCSys,
				"num_gc":          mem.NumGC,
				"last_gc":         mem.LastGC / 1e9,
				"gc_pause_avg_us": gcPauseAvg,
			},
			"database":     dbStats,
			"log_database": logDbStats,
			"redis":        redisInfo,
			"request_stats": gin.H{
				"today_requests": todayStat.Requests,
				"today_tokens":   todayStat.Tokens,
				"today_quota":    todayStat.Quota,
				"total_requests": totalStat.Requests,
				"total_tokens":   totalStat.Tokens,
				"total_quota":    totalStat.Quota,
			},
			"request_health": requestHealth,
			"disk_cache": gin.H{
				"active_disk_files":    dcStats.ActiveDiskFiles,
				"disk_usage_bytes":     dcStats.CurrentDiskUsageBytes,
				"active_memory_bufs":   dcStats.ActiveMemoryBuffers,
				"memory_usage_bytes":   dcStats.CurrentMemoryUsageBytes,
				"disk_hits":            dcStats.DiskCacheHits,
				"memory_hits":          dcStats.MemoryCacheHits,
				"disk_max_bytes":       dcStats.DiskCacheMaxBytes,
				"disk_threshold_bytes": dcStats.DiskCacheThresholdBytes,
			},
			"channel_affinity": gin.H{
				"enabled":        affinityStats.Enabled,
				"total":          affinityStats.Total,
				"cache_capacity": affinityStats.CacheCapacity,
				"cache_algo":     affinityStats.CacheAlgo,
			},
		},
	})
}

func poolPressure(stats gin.H) float64 {
	if stats == nil {
		return 0
	}
	maxOpen, ok := stats["max_open"].(int)
	if !ok || maxOpen <= 0 {
		return 0
	}
	inUse, ok := stats["in_use"].(int)
	if !ok {
		return 0
	}
	return float64(inUse) / float64(maxOpen) * 100
}
