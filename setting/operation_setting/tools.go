package operation_setting

import (
	"strings"
	"sync"
)

var toolPriceOverrides = struct {
	sync.RWMutex
	prices map[string]float64
}{prices: make(map[string]float64)}

const (
	// Web search
	WebSearchPriceHigh = 25.00
	WebSearchPrice     = 10.00
	// File search
	FileSearchPrice = 2.5
)

const (
	GPTImage1Low1024x1024    = 0.011
	GPTImage1Low1024x1536    = 0.016
	GPTImage1Low1536x1024    = 0.016
	GPTImage1Medium1024x1024 = 0.042
	GPTImage1Medium1024x1536 = 0.063
	GPTImage1Medium1536x1024 = 0.063
	GPTImage1High1024x1024   = 0.167
	GPTImage1High1024x1536   = 0.25
	GPTImage1High1536x1024   = 0.25
)

const (
	// Claude Web search
	ClaudeWebSearchPrice = 10.00
)

func GetClaudeWebSearchPricePerThousand() float64 {
	return ClaudeWebSearchPrice
}

func GetWebSearchPricePerThousand(modelName string, contextSize string) float64 {
	// 确定模型类型
	// https://platform.openai.com/docs/pricing Web search 价格按模型类型收费
	// 新版计费规则不再关联 search context size，故在const区域将各size的价格设为一致。
	// gpt-5, gpt-5-mini, gpt-5-nano 和 o 系列模型价格为 10.00 美元/千次调用，产生额外 token 计入 input_tokens
	// gpt-4o, gpt-4.1, gpt-4o-mini 和 gpt-4.1-mini 价格为 25.00 美元/千次调用，不产生额外 token
	isNormalPriceModel :=
		strings.HasPrefix(modelName, "o3") ||
			strings.HasPrefix(modelName, "o4") ||
			strings.HasPrefix(modelName, "gpt-5")
	var priceWebSearchPerThousandCalls float64
	if isNormalPriceModel {
		priceWebSearchPerThousandCalls = WebSearchPrice
	} else {
		priceWebSearchPerThousandCalls = WebSearchPriceHigh
	}
	return priceWebSearchPerThousandCalls
}

func GetFileSearchPricePerThousand() float64 {
	return FileSearchPrice
}

func GetToolPriceForModel(toolName, modelName string) float64 {
	toolPriceOverrides.RLock()
	defer toolPriceOverrides.RUnlock()
	if price, ok := toolPriceOverrides.prices[toolName+":"+modelName]; ok {
		return price
	}
	if price, ok := toolPriceOverrides.prices[toolName]; ok {
		return price
	}
	switch toolName {
	case "web_search", "web_search_preview":
		return GetWebSearchPricePerThousand(modelName, "")
	case "file_search":
		return GetFileSearchPricePerThousand()
	default:
		return 0
	}
}

func SetToolPriceForTest(name string, price float64) {
	toolPriceOverrides.Lock()
	defer toolPriceOverrides.Unlock()
	toolPriceOverrides.prices[name] = price
}

func DeleteToolPriceForTest(name string) {
	toolPriceOverrides.Lock()
	defer toolPriceOverrides.Unlock()
	delete(toolPriceOverrides.prices, name)
}

func GetGPTImage1PriceOnceCall(quality string, size string) float64 {
	prices := map[string]map[string]float64{
		"low": {
			"1024x1024": GPTImage1Low1024x1024,
			"1024x1536": GPTImage1Low1024x1536,
			"1536x1024": GPTImage1Low1536x1024,
		},
		"medium": {
			"1024x1024": GPTImage1Medium1024x1024,
			"1024x1536": GPTImage1Medium1024x1536,
			"1536x1024": GPTImage1Medium1536x1024,
		},
		"high": {
			"1024x1024": GPTImage1High1024x1024,
			"1024x1536": GPTImage1High1024x1536,
			"1536x1024": GPTImage1High1536x1024,
		},
	}

	if qualityMap, exists := prices[quality]; exists {
		if price, exists := qualityMap[size]; exists {
			return price
		}
	}

	return GPTImage1High1024x1024
}
