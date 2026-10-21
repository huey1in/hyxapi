package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const maxModelsDevResponseBytes int64 = 10 << 20
const maxModelDescriptionBytes = 4096

// UpstreamModelPricing associates a normalized original price with its source.
type UpstreamModelPricing struct {
	Provider    string       `json:"provider"`
	Description string       `json:"description,omitempty"`
	Pricing     ModelPricing `json:"pricing"`
}

type modelsDevProvider struct {
	Models map[string]modelsDevModel `json:"models"`
}

type modelsDevModel struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Cost        modelsDevCost `json:"cost"`
}

type modelsDevCost struct {
	Input      float64 `json:"input"`
	Output     float64 `json:"output"`
	CacheRead  float64 `json:"cache_read"`
	CacheWrite float64 `json:"cache_write"`
}

var officialPricingProviders = map[string]struct{}{
	"alibaba": {}, "anthropic": {}, "cohere": {}, "deepseek": {},
	"google": {}, "huawei": {}, "meta": {}, "mistral": {},
	"moonshotai": {}, "openai": {}, "qwen": {}, "xai": {}, "zhipuai": {},
}

func upstreamProviderPriority(provider string) int {
	if _, official := officialPricingProviders[provider]; official {
		return 0
	}
	return 1
}

// ParseModelsDevPrices converts models.dev token costs into HyxAPI's USD per
// million token price schema. The first provider alphabetically wins when the
// same model identifier is published by more than one provider.
func ParseModelsDevPrices(reader io.Reader) ([]UpstreamModelPricing, error) {
	var providers map[string]modelsDevProvider
	if err := json.NewDecoder(reader).Decode(&providers); err != nil {
		return nil, err
	}

	providerNames := make([]string, 0, len(providers))
	for name := range providers {
		providerNames = append(providerNames, name)
	}
	sort.Slice(providerNames, func(i, j int) bool {
		leftPriority := upstreamProviderPriority(providerNames[i])
		rightPriority := upstreamProviderPriority(providerNames[j])
		if leftPriority != rightPriority {
			return leftPriority < rightPriority
		}
		return providerNames[i] < providerNames[j]
	})

	seen := make(map[string]struct{})
	prices := make([]UpstreamModelPricing, 0)
	for _, providerName := range providerNames {
		provider := providers[providerName]
		modelNames := make([]string, 0, len(provider.Models))
		for name := range provider.Models {
			modelNames = append(modelNames, name)
		}
		sort.Strings(modelNames)
		for _, modelName := range modelNames {
			name := strings.TrimSpace(modelName)
			if name == "" {
				continue
			}
			if _, exists := seen[name]; exists {
				continue
			}
			cost := provider.Models[modelName].Cost
			values := []float64{cost.Input, cost.Output, cost.CacheRead, cost.CacheWrite}
			valid := true
			hasPrice := false
			for _, value := range values {
				if value < 0 || math.IsNaN(value) || math.IsInf(value, 0) {
					valid = false
					break
				}
				hasPrice = hasPrice || value > 0
			}
			if !valid || !hasPrice {
				continue
			}
			seen[name] = struct{}{}
			prices = append(prices, UpstreamModelPricing{
				Provider:    providerName,
				Description: strings.TrimSpace(provider.Models[modelName].Description),
				Pricing: ModelPricing{
					ModelName:       name,
					BillingType:     ModelPricingBillingToken,
					InputPrice:      cost.Input,
					OutputPrice:     cost.Output,
					CacheReadPrice:  cost.CacheRead,
					CacheWritePrice: cost.CacheWrite,
					Enabled:         true,
				},
			})
		}
	}
	sort.Slice(prices, func(i, j int) bool {
		return prices[i].Pricing.ModelName < prices[j].Pricing.ModelName
	})
	return prices, nil
}

// FilterUpstreamModelPrices restricts an upstream catalog to models currently
// enabled by local channel abilities.
func FilterUpstreamModelPrices(prices []UpstreamModelPricing, enabledModels []string) []UpstreamModelPricing {
	byName := make(map[string]UpstreamModelPricing, len(prices))
	for _, price := range prices {
		byName[price.Pricing.ModelName] = price
	}
	filtered := make([]UpstreamModelPricing, 0, len(prices))
	seen := make(map[string]struct{}, len(enabledModels))
	for _, modelName := range enabledModels {
		name := strings.TrimSpace(modelName)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		price, ok := byName[name]
		basePrice, hasBase := byName[baseModelPricingName(name)]
		if hasBase && (!ok || (price.Pricing.CacheReadPrice == 0 && price.Pricing.CacheWritePrice == 0)) {
			if ok {
				if price.Pricing.CacheReadPrice == 0 {
					price.Pricing.CacheReadPrice = basePrice.Pricing.CacheReadPrice
				}
				if price.Pricing.CacheWritePrice == 0 {
					price.Pricing.CacheWritePrice = basePrice.Pricing.CacheWritePrice
				}
			} else {
				price = basePrice
				ok = true
			}
			price.Pricing.ModelName = name
		}
		if ok {
			filtered = append(filtered, price)
		}
	}
	return filtered
}

var datedModelSuffix = regexp.MustCompile(`-\d{8}$`)

// baseModelPricingName maps dated and thinking variants to the stable model
// identifier used by upstream price catalogs, while keeping the local model
// name unchanged in the returned pricing row.
func baseModelPricingName(name string) string {
	base := strings.TrimSuffix(name, "-thinking")
	return datedModelSuffix.ReplaceAllString(base, "")
}

// FetchModelsDevPrices loads and parses a models.dev-compatible catalog.
func FetchModelsDevPrices(client *http.Client, endpoint string) ([]UpstreamModelPricing, error) {
	if client == nil {
		return nil, errors.New("models.dev HTTP client cannot be nil")
	}
	request, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("fetch upstream model prices: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("fetch upstream model prices: HTTP %d", response.StatusCode)
	}

	limited := io.LimitReader(response.Body, maxModelsDevResponseBytes+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("read upstream model prices: %w", err)
	}
	if int64(len(body)) > maxModelsDevResponseBytes {
		return nil, errors.New("upstream model pricing response is too large")
	}
	return ParseModelsDevPrices(strings.NewReader(string(body)))
}

// ApplyModelPricingSync applies canonical fetched prices for selected enabled
// models in one transaction. Callers should re-fetch prices before invoking it.
func ApplyModelPricingSync(prices []UpstreamModelPricing, selectedModels, enabledModels []string) (int, error) {
	if DB == nil {
		return 0, errors.New("database is not initialized")
	}
	enabled := make(map[string]struct{}, len(enabledModels))
	for _, name := range enabledModels {
		enabled[strings.TrimSpace(name)] = struct{}{}
	}
	upstream := make(map[string]ModelPricing, len(prices))
	for _, item := range prices {
		upstream[item.Pricing.ModelName] = item.Pricing
	}

	selected := make([]ModelPricing, 0, len(selectedModels))
	seen := make(map[string]struct{}, len(selectedModels))
	for _, selectedName := range selectedModels {
		name := strings.TrimSpace(selectedName)
		if name == "" {
			return 0, errors.New("selected model name cannot be empty")
		}
		if _, duplicate := seen[name]; duplicate {
			continue
		}
		seen[name] = struct{}{}
		if _, ok := enabled[name]; !ok {
			return 0, fmt.Errorf("model %s is not enabled", name)
		}
		pricing, ok := upstream[name]
		if !ok {
			return 0, fmt.Errorf("model %s is not available from upstream", name)
		}
		pricing.ModelName = name
		pricing.BillingType = ModelPricingBillingToken
		pricing.Enabled = true
		if !isValidModelPricing(pricing) {
			return 0, fmt.Errorf("model %s has invalid upstream pricing", name)
		}
		selected = append(selected, pricing)
	}
	if len(selected) == 0 {
		return 0, errors.New("no model prices selected")
	}

	now := common.GetTimestamp()
	err := DB.Transaction(func(tx *gorm.DB) error {
		for i := range selected {
			pricing := &selected[i]
			var existing ModelPricing
			err := tx.Where("model_name = ?", pricing.ModelName).First(&existing).Error
			switch {
			case err == nil:
				pricing.ID = existing.ID
				pricing.CreatedTime = existing.CreatedTime
			case errors.Is(err, gorm.ErrRecordNotFound):
				pricing.CreatedTime = now
			case err != nil:
				return err
			}
			pricing.UpdatedTime = now
			if err := tx.Save(pricing).Error; err != nil {
				return err
			}
			if description := upstreamDescriptionFor(prices, pricing.ModelName); description != "" {
				var metadata Model
				metadataErr := tx.Where("model_name = ?", pricing.ModelName).First(&metadata).Error
				switch {
				case errors.Is(metadataErr, gorm.ErrRecordNotFound):
					metadata = Model{ModelName: pricing.ModelName, Description: description, Status: 1, SyncOfficial: 1, CreatedTime: now, UpdatedTime: now}
					if err := tx.Create(&metadata).Error; err != nil {
						return err
					}
				case metadataErr != nil:
					return metadataErr
				case strings.TrimSpace(metadata.Description) == "":
					if err := tx.Model(&metadata).Updates(map[string]interface{}{"description": description, "updated_time": now}).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	InvalidateModelPricingCache()
	return len(selected), nil
}

func upstreamDescriptionFor(prices []UpstreamModelPricing, modelName string) string {
	for _, item := range prices {
		if item.Pricing.ModelName != modelName {
			continue
		}
		description := strings.TrimSpace(item.Description)
		if len(description) > maxModelDescriptionBytes {
			description = description[:maxModelDescriptionBytes]
		}
		return description
	}
	return ""
}

// GetModelDescriptions returns descriptions keyed by exact model name.
func GetModelDescriptions(modelNames []string) (map[string]string, error) {
	descriptions := make(map[string]string)
	if DB == nil || len(modelNames) == 0 {
		return descriptions, nil
	}
	var metadata []Model
	if err := DB.Where("model_name IN ?", modelNames).Find(&metadata).Error; err != nil {
		return nil, err
	}
	for _, item := range metadata {
		descriptions[item.ModelName] = strings.TrimSpace(item.Description)
	}
	return descriptions, nil
}
