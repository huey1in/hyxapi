package model

import (
	"fmt"
	"sync"
)

const maxHealthRecords = 80

// API response types
type ModelHealthRecord struct {
	Status       string `json:"status"`
	Latency      int64  `json:"latency"`
	CheckedAt    int64  `json:"checked_at"`
	Total        int64  `json:"total"`
	Errors       int64  `json:"errors"`
	PromptTokens int64  `json:"prompt_tokens"`
	CacheTokens  int64  `json:"cache_tokens"`
	Error        string `json:"error,omitempty"`
}

type ModelGroupHealth struct {
	Model   string              `json:"model"`
	Group   string              `json:"group"`
	Current *ModelHealthRecord  `json:"current"`
	History []ModelHealthRecord `json:"history"`
}

// ring buffer per model+group (in-memory)
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

// RecordModelHealth stores a health record in memory ring buffer.
func RecordModelHealth(model, group string, rec ModelHealthRecord) {
	key := healthKey(group, model)
	healthMu.Lock()
	ring, ok := healthStore[key]
	if !ok {
		ring = &healthRing{}
		healthStore[key] = ring
	}
	ring.push(rec)
	healthMu.Unlock()
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

// CleanupOldHealthRecords is now a no-op (no DB table to clean).
func CleanupOldHealthRecords() {}
