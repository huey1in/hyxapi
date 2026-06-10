package cache_setting

import "github.com/QuantumNous/new-api/setting/config"

type SemanticCacheSetting struct {
	Enabled          bool    `json:"enabled"`
	TTLSeconds       int     `json:"ttl_seconds"`
	MaxEntries       int     `json:"max_entries"`
	CacheEmbeddings  bool    `json:"cache_embeddings"`
	CacheCompletions bool    `json:"cache_completions"`
	HitCostRatio     float64 `json:"hit_cost_ratio"`
}

var semanticCacheSetting = SemanticCacheSetting{
	Enabled:          false,
	TTLSeconds:       3600,
	MaxEntries:       10000,
	CacheEmbeddings:  true,
	CacheCompletions: true,
	HitCostRatio:     0.1,
}

func init() {
	config.GlobalConfig.Register("semantic_cache_setting", &semanticCacheSetting)
}

func GetSetting() *SemanticCacheSetting {
	return &semanticCacheSetting
}
