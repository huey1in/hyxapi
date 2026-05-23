package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const maxHealthRecords = 50

// DB model — persisted to database
type ModelHealthCheck struct {
	ID        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Model     string `json:"model" gorm:"type:varchar(255);index:idx_mhc_model_group;index:idx_mhc_checked"`
	GroupName string `json:"group_name" gorm:"type:varchar(100);index:idx_mhc_model_group"`
	Status    string `json:"status" gorm:"type:varchar(10)"`  // "up" / "down"
	Latency   int64  `json:"latency"`                         // ms
	Error     string `json:"error,omitempty" gorm:"type:text"`
	CheckedAt int64  `json:"checked_at" gorm:"index:idx_mhc_checked"`
}

func (ModelHealthCheck) TableName() string {
	return "model_health_checks"
}

// API response types (unchanged)
type ModelHealthRecord struct {
	Status    string `json:"status"`
	Latency   int64  `json:"latency"`
	CheckedAt int64  `json:"checked_at"`
	Error     string `json:"error,omitempty"`
}

type ModelGroupHealth struct {
	Model   string              `json:"model"`
	Group   string              `json:"group"`
	Current *ModelHealthRecord  `json:"current"`
	History []ModelHealthRecord `json:"history"`
}

// ring buffer per model+group (in-memory cache for fast reads)
type healthRing struct {
	buf  [maxHealthRecords]ModelHealthRecord
	pos  int
	size int
}

func (r *healthRing) push(rec ModelHealthRecord) {
	r.buf[r.pos] = rec
	r.pos = (r.pos + 1) % maxHealthRecords
	if r.size < maxHealthRecords {
		r.size++
	}
}

// newest first
func (r *healthRing) records() []ModelHealthRecord {
	out := make([]ModelHealthRecord, 0, r.size)
	for i := 0; i < r.size; i++ {
		idx := (r.pos - 1 - i + maxHealthRecords) % maxHealthRecords
		out = append(out, r.buf[idx])
	}
	return out
}

func (r *healthRing) latest() *ModelHealthRecord {
	if r.size == 0 {
		return nil
	}
	idx := (r.pos - 1 + maxHealthRecords) % maxHealthRecords
	rec := r.buf[idx]
	return &rec
}

var (
	healthStore = make(map[string]*healthRing)
	healthMu    sync.RWMutex
)

func healthKey(group, model string) string {
	return fmt.Sprintf("%s:%s", group, model)
}

// LoadModelHealthFromDB loads recent records from database into memory on startup.
func LoadModelHealthFromDB() {
	if DB == nil {
		return
	}

	// Only load records from the last 24 hours, ordered oldest first
	cutoff := time.Now().Add(-24 * time.Hour).Unix()
	var rows []ModelHealthCheck
	err := DB.Where("checked_at >= ?", cutoff).
		Order("checked_at ASC").
		Find(&rows).Error

	if err != nil {
		common.SysError(fmt.Sprintf("failed to load model health from DB: %v", err))
		return
	}

	healthMu.Lock()
	defer healthMu.Unlock()

	for _, row := range rows {
		key := healthKey(row.GroupName, row.Model)
		ring, ok := healthStore[key]
		if !ok {
			ring = &healthRing{}
			healthStore[key] = ring
		}
		ring.push(ModelHealthRecord{
			Status:    row.Status,
			Latency:   row.Latency,
			CheckedAt: row.CheckedAt,
			Error:     row.Error,
		})
	}

	common.SysLog(fmt.Sprintf("loaded %d model health records from database", len(rows)))
}

// CleanupOldHealthRecords removes records older than 24 hours.
func CleanupOldHealthRecords() {
	if DB == nil {
		return
	}
	cutoff := time.Now().Add(-24 * time.Hour).Unix()
	result := DB.Where("checked_at < ?", cutoff).Delete(&ModelHealthCheck{})
	if result.Error != nil {
		common.SysError(fmt.Sprintf("failed to cleanup old health records: %v", result.Error))
	} else if result.RowsAffected > 0 {
		common.SysLog(fmt.Sprintf("cleaned up %d old health records", result.RowsAffected))
	}
}

// RecordModelHealth stores a health check result in both memory and database.
func RecordModelHealth(model, group string, rec ModelHealthRecord) {
	key := healthKey(group, model)

	// Write to memory
	healthMu.Lock()
	ring, ok := healthStore[key]
	if !ok {
		ring = &healthRing{}
		healthStore[key] = ring
	}
	ring.push(rec)
	healthMu.Unlock()

	// Write to database (async, non-blocking)
	if DB != nil {
		go func() {
			dbRec := ModelHealthCheck{
				Model:     model,
				GroupName: group,
				Status:    rec.Status,
				Latency:   rec.Latency,
				Error:     rec.Error,
				CheckedAt: rec.CheckedAt,
			}
			if err := DB.Create(&dbRec).Error; err != nil {
				common.SysError(fmt.Sprintf("failed to persist health record: %v", err))
			}
		}()
	}
}

// GetModelHealthByModel returns health for a specific model across all groups.
func GetModelHealthByModel(model string) []ModelGroupHealth {
	healthMu.RLock()
	defer healthMu.RUnlock()
	var results []ModelGroupHealth
	for k, ring := range healthStore {
		var g, m string
		for i := 0; i < len(k); i++ {
			if k[i] == ':' {
				g = k[:i]
				m = k[i+1:]
				break
			}
		}
		if m != model {
			continue
		}
		results = append(results, ModelGroupHealth{
			Model:   m,
			Group:   g,
			Current: ring.latest(),
			History: ring.records(),
		})
	}
	return results
}

// GetAllModelHealth returns health for all models grouped by model name.
func GetAllModelHealth() map[string][]ModelGroupHealth {
	healthMu.RLock()
	defer healthMu.RUnlock()
	result := make(map[string][]ModelGroupHealth)
	for k, ring := range healthStore {
		var g, m string
		for i := 0; i < len(k); i++ {
			if k[i] == ':' {
				g = k[:i]
				m = k[i+1:]
				break
			}
		}
		result[m] = append(result[m], ModelGroupHealth{
			Model:   m,
			Group:   g,
			Current: ring.latest(),
			History: ring.records(),
		})
	}
	return result
}

// GetModelGroupHealth returns health for a specific model+group.
func GetModelGroupHealth(model, group string) *ModelGroupHealth {
	key := healthKey(group, model)
	healthMu.RLock()
	defer healthMu.RUnlock()
	ring, ok := healthStore[key]
	if !ok {
		return nil
	}
	return &ModelGroupHealth{
		Model:   model,
		Group:   group,
		Current: ring.latest(),
		History: ring.records(),
	}
}
