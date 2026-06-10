package service

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/cache_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// SemanticCacheEntry stores a cached upstream response.
type SemanticCacheEntry struct {
	ResponseBody []byte
	ContentType  string
	StatusCode   int
	Usage        *dto.Usage
	CreatedAt    int64
	lastAccess   int64
	hitCount     int64
}

var (
	semanticCache sync.Map
	cacheCount    int64
)

func init() {
	go semanticCacheCleanupLoop()
}

func semanticCacheCleanupLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		cfg := cache_setting.GetSetting()
		if !cfg.Enabled {
			continue
		}
		now := time.Now().Unix()
		ttl := int64(cfg.TTLSeconds)
		maxEntries := int64(cfg.MaxEntries)

		semanticCache.Range(func(key, value any) bool {
			entry := value.(*SemanticCacheEntry)
			if now-entry.CreatedAt > ttl {
				semanticCache.Delete(key)
				atomic.AddInt64(&cacheCount, -1)
			}
			return true
		})

		// If still over max entries, evict oldest-accessed first
		current := atomic.LoadInt64(&cacheCount)
		if current > maxEntries {
			type kv struct {
				key        any
				lastAccess int64
			}
			var entries []kv
			semanticCache.Range(func(key, value any) bool {
				entries = append(entries, kv{key: key, lastAccess: value.(*SemanticCacheEntry).lastAccess})
				return true
			})
			sort.Slice(entries, func(i, j int) bool {
				return entries[i].lastAccess < entries[j].lastAccess
			})
			toRemove := int(current - maxEntries)
			for i := 0; i < toRemove && i < len(entries); i++ {
				semanticCache.Delete(entries[i].key)
				atomic.AddInt64(&cacheCount, -1)
			}
		}
	}
}

// SemanticCacheGet looks up a cached response by key.
func SemanticCacheGet(key string) (*SemanticCacheEntry, bool) {
	val, ok := semanticCache.Load(key)
	if !ok {
		return nil, false
	}
	entry := val.(*SemanticCacheEntry)
	cfg := cache_setting.GetSetting()
	if time.Now().Unix()-entry.CreatedAt > int64(cfg.TTLSeconds) {
		semanticCache.Delete(key)
		atomic.AddInt64(&cacheCount, -1)
		return nil, false
	}
	atomic.StoreInt64(&entry.lastAccess, time.Now().Unix())
	atomic.AddInt64(&entry.hitCount, 1)
	return entry, true
}

// SemanticCacheSet stores a response in the cache.
func SemanticCacheSet(key string, entry *SemanticCacheEntry) {
	cfg := cache_setting.GetSetting()
	if atomic.LoadInt64(&cacheCount) >= int64(cfg.MaxEntries) {
		return
	}
	entry.CreatedAt = time.Now().Unix()
	entry.lastAccess = entry.CreatedAt
	if _, loaded := semanticCache.LoadOrStore(key, entry); !loaded {
		atomic.AddInt64(&cacheCount, 1)
	}
}

func hashBytes(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// BuildEmbeddingCacheKey builds a deterministic cache key for an embedding request.
func BuildEmbeddingCacheKey(model string, req *dto.EmbeddingRequest) string {
	inputs := req.ParseInput()
	sort.Strings(inputs)
	var b strings.Builder
	b.WriteString("embed:")
	b.WriteString(model)
	b.WriteByte(':')
	for i, s := range inputs {
		if i > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(s)
	}
	if req.Dimensions != nil {
		b.WriteString(fmt.Sprintf(":dim=%d", *req.Dimensions))
	}
	if req.EncodingFormat != "" {
		b.WriteString(":fmt=" + req.EncodingFormat)
	}
	return "sc:" + hashBytes([]byte(b.String()))
}

// BuildChatCacheKey builds a deterministic cache key for a chat completion with temperature=0.
func BuildChatCacheKey(model string, req *dto.GeneralOpenAIRequest) string {
	var b strings.Builder
	b.WriteString("chat:")
	b.WriteString(model)
	b.WriteByte(':')

	// Messages — serialize role+content canonically
	for i, msg := range req.Messages {
		if i > 0 {
			b.WriteByte('|')
		}
		b.WriteString(msg.Role)
		b.WriteByte(':')
		b.WriteString(msg.StringContent())
	}

	if req.Temperature != nil {
		b.WriteString(fmt.Sprintf(":t=%.6f", *req.Temperature))
	}
	if req.Seed != nil {
		b.WriteString(fmt.Sprintf(":seed=%.0f", *req.Seed))
	}
	if req.MaxTokens != nil {
		b.WriteString(fmt.Sprintf(":mt=%d", *req.MaxTokens))
	}
	if req.MaxCompletionTokens != nil {
		b.WriteString(fmt.Sprintf(":mct=%d", *req.MaxCompletionTokens))
	}
	if req.Tools != nil {
		toolData, _ := common.Marshal(req.Tools)
		b.WriteString(":tools=" + hashBytes(toolData))
	}
	if req.ResponseFormat != nil {
		rfData, _ := common.Marshal(req.ResponseFormat)
		b.WriteString(":rf=" + hashBytes(rfData))
	}

	return "sc:" + hashBytes([]byte(b.String()))
}

// IsCacheableRequest checks whether a request can be served from cache.
func IsCacheableRequest(relayMode int, request dto.Request, isStream bool) bool {
	cfg := cache_setting.GetSetting()
	if !cfg.Enabled {
		return false
	}
	if isStream {
		return false
	}

	switch relayMode {
	case relayconstant.RelayModeEmbeddings:
		return cfg.CacheEmbeddings
	case relayconstant.RelayModeChatCompletions:
		if !cfg.CacheCompletions {
			return false
		}
		chatReq, ok := request.(*dto.GeneralOpenAIRequest)
		if !ok {
			return false
		}
		// Only cache deterministic requests
		temp := lo.FromPtrOr(chatReq.Temperature, -1.0)
		hasSeed := chatReq.Seed != nil
		return temp == 0 || hasSeed
	}
	return false
}

// BuildCacheKey dispatches to the appropriate key builder based on relay mode.
func BuildCacheKey(relayMode int, model string, request dto.Request) string {
	switch relayMode {
	case relayconstant.RelayModeEmbeddings:
		if req, ok := request.(*dto.EmbeddingRequest); ok {
			return BuildEmbeddingCacheKey(model, req)
		}
	case relayconstant.RelayModeChatCompletions:
		if req, ok := request.(*dto.GeneralOpenAIRequest); ok {
			return BuildChatCacheKey(model, req)
		}
	}
	return ""
}

// WriteCachedResponse writes a cached response directly to the gin writer.
func WriteCachedResponse(c *gin.Context, entry *SemanticCacheEntry) {
	if entry.ContentType != "" {
		c.Writer.Header().Set("Content-Type", entry.ContentType)
	}
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(entry.ResponseBody)))
	c.Writer.Header().Set("X-Cache", "HIT")
	status := entry.StatusCode
	if status == 0 {
		status = http.StatusOK
	}
	c.Writer.WriteHeader(status)
	c.Writer.Write(entry.ResponseBody)
	c.Writer.Flush()
}

// CachingResponseWriter wraps gin.ResponseWriter to record the response for caching.
type CachingResponseWriter struct {
	gin.ResponseWriter
	body        *bytes.Buffer
	contentType string
	statusCode  int
}

func NewCachingResponseWriter(w gin.ResponseWriter) *CachingResponseWriter {
	return &CachingResponseWriter{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
	}
}

func (w *CachingResponseWriter) Write(data []byte) (int, error) {
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func (w *CachingResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *CachingResponseWriter) WriteHeaderNow() {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	w.ResponseWriter.WriteHeaderNow()
}

func (w *CachingResponseWriter) GetRecordedResponse() ([]byte, string, int) {
	ct := w.ResponseWriter.Header().Get("Content-Type")
	code := w.statusCode
	if code == 0 {
		code = http.StatusOK
	}
	return w.body.Bytes(), ct, code
}

// GetSemanticCacheStats returns basic statistics about the cache.
func GetSemanticCacheStats() map[string]interface{} {
	count := atomic.LoadInt64(&cacheCount)
	var totalHits int64
	semanticCache.Range(func(key, value any) bool {
		entry := value.(*SemanticCacheEntry)
		totalHits += atomic.LoadInt64(&entry.hitCount)
		return true
	})
	return map[string]interface{}{
		"entries":    count,
		"total_hits": totalHits,
	}
}
