package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

var (
	modelHealthOnce    sync.Once
	modelHealthRunning atomic.Bool
	modelHealthTicker  *time.Ticker
	modelHealthMu      sync.Mutex
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
			common.SysLog(fmt.Sprintf("model health check task started: interval=%s", interval))

			modelHealthMu.Lock()
			modelHealthTicker = time.NewTicker(interval)
			modelHealthMu.Unlock()

			// first run after 30s delay to let the system warm up
			time.Sleep(30 * time.Second)
			runModelHealthCheckOnce()
			model.CleanupOldHealthRecords()
			for range modelHealthTicker.C {
				setting := operation_setting.GetMonitorSetting()
				if !setting.ModelHealthEnabled {
					continue
				}
				runModelHealthCheckOnce()
				model.CleanupOldHealthRecords()
			}
		})
	})
}

func runModelHealthCheckOnce() {
	if !modelHealthRunning.CompareAndSwap(false, true) {
		return
	}
	defer modelHealthRunning.Store(false)

	pricing := model.GetPricing()
	if len(pricing) == 0 {
		return
	}

	// Build unique (model, group) pairs
	type pair struct {
		model string
		group string
	}
	seen := make(map[pair]bool)
	var pairs []pair
	for _, p := range pricing {
		for _, g := range p.EnableGroup {
			if g == "all" {
				continue
			}
			key := pair{p.ModelName, g}
			if !seen[key] {
				seen[key] = true
				pairs = append(pairs, key)
			}
		}
	}

	// Check concurrently with limited parallelism
	sem := make(chan struct{}, 10)
	var wg sync.WaitGroup
	for _, pp := range pairs {
		pp := pp
		wg.Add(1)
		sem <- struct{}{}
		gopool.Go(func() {
			defer wg.Done()
			defer func() { <-sem }()
			checkModelGroup(pp.model, pp.group)
		})
	}
	wg.Wait()
}

func checkModelGroup(modelName, group string) {
	start := time.Now()

	// Find a channel for this model+group
	channel, err := model.GetRandomSatisfiedChannel(group, modelName, 0)
	if err != nil || channel == nil {
		model.RecordModelHealth(modelName, group, model.ModelHealthRecord{
			Status:    "down",
			Latency:   0,
			CheckedAt: time.Now().Unix(),
			Error:     "no available channel",
		})
		return
	}

	// Make a simple test request via internal HTTP
	err = doHealthCheck(channel, modelName)
	latency := time.Since(start).Milliseconds()

	rec := model.ModelHealthRecord{
		CheckedAt: time.Now().Unix(),
		Latency:   latency,
	}
	if err != nil {
		rec.Status = "down"
		rec.Error = truncateStr(err.Error(), 100)
	} else {
		rec.Status = "up"
	}
	model.RecordModelHealth(modelName, group, rec)
}

func doHealthCheck(channel *model.Channel, modelName string) error {
	// Build a minimal request body
	body := map[string]any{
		"model":      modelName,
		"max_tokens": 3,
		"messages": []map[string]string{
			{"role": "user", "content": "hi"},
		},
	}

	// Determine request path based on model type
	requestPath := "/v1/chat/completions"
	if strings.Contains(modelName, "claude") {
		requestPath = "/v1/messages"
		body = map[string]any{
			"model":      modelName,
			"max_tokens": 3,
			"messages": []map[string]string{
				{"role": "user", "content": "hi"},
			},
		}
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal body: %w", err)
	}

	// Use the channel's base URL directly
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = *channel.BaseURL
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}

	url := baseURL + requestPath

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Set auth headers based on channel type
	keys := channel.GetKeys()
	apiKey := ""
	if len(keys) > 0 {
		apiKey = keys[0]
	}
	if strings.Contains(requestPath, "messages") {
		// Anthropic style
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// unused but keep for reference — internal gin-based test
func doInternalHealthCheck(modelName string) error {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	_ = c
	// could use the relay pipeline here if needed
	return nil
}
