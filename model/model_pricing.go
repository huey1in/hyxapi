package model

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Model pricing is kept separately from model metadata and channel abilities.
// Prices are the provider's original USD prices. Token prices are expressed
// per one million tokens; request prices are expressed per request.
const (
	ModelPricingBillingToken   = 0
	ModelPricingBillingRequest = 1
)

// ModelPricing stores one original price schedule for a model. Group-specific
// multipliers are configured in ratio_setting and are applied by the relay
// billing layer at request time.
type ModelPricing struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	ModelName string `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_pricing_model_name"`

	// BillingType is ModelPricingBillingToken or ModelPricingBillingRequest.
	BillingType int `json:"billing_type" gorm:"not null;default:0;index"`

	// Token prices are USD per 1M tokens. RequestPrice is USD per request.
	InputPrice       float64 `json:"input_price" gorm:"not null;default:0"`
	OutputPrice      float64 `json:"output_price" gorm:"not null;default:0"`
	CacheReadPrice   float64 `json:"cache_read_price" gorm:"not null;default:0"`
	CacheWritePrice  float64 `json:"cache_write_price" gorm:"not null;default:0"`
	ImagePrice       float64 `json:"image_price" gorm:"not null;default:0"`
	AudioInputPrice  float64 `json:"audio_input_price" gorm:"not null;default:0"`
	AudioOutputPrice float64 `json:"audio_output_price" gorm:"not null;default:0"`
	RequestPrice     float64 `json:"request_price" gorm:"not null;default:0"`

	Enabled     bool  `json:"enabled" gorm:"not null;index"`
	CreatedTime int64 `json:"created_time" gorm:"bigint"`
	UpdatedTime int64 `json:"updated_time" gorm:"bigint"`
}

func (ModelPricing) TableName() string {
	return "model_pricing"
}

// BillingTypeName renders the internal numeric type for the public pricing API.
// An unknown value is intentionally not normalized into a valid billing mode.
func (p ModelPricing) BillingTypeName() string {
	switch p.BillingType {
	case ModelPricingBillingToken:
		return "tokens"
	case ModelPricingBillingRequest:
		return "request"
	default:
		return ""
	}
}

var modelPricingCache = struct {
	sync.RWMutex
	values   map[string]ModelPricing
	loadedAt time.Time
	db       *gorm.DB
}{values: make(map[string]ModelPricing)}

const modelPricingCacheTTL = time.Minute

// normalizeModelPricingName keeps lookup keys stable without changing the
// model name stored in the database.
func normalizeModelPricingName(name string) string {
	return strings.TrimSpace(name)
}

func isValidModelPricing(pricing ModelPricing) bool {
	if normalizeModelPricingName(pricing.ModelName) == "" {
		return false
	}
	if pricing.BillingType != ModelPricingBillingToken && pricing.BillingType != ModelPricingBillingRequest {
		return false
	}
	prices := [...]float64{
		pricing.InputPrice,
		pricing.OutputPrice,
		pricing.CacheReadPrice,
		pricing.CacheWritePrice,
		pricing.ImagePrice,
		pricing.AudioInputPrice,
		pricing.AudioOutputPrice,
		pricing.RequestPrice,
	}
	for _, price := range prices {
		if math.IsNaN(price) || math.IsInf(price, 0) || price < 0 {
			return false
		}
	}
	return true
}

// InvalidateModelPricingCache forces the next lookup to reload prices from DB.
// Call this after creating, updating, or deleting a ModelPricing row.
func InvalidateModelPricingCache() {
	modelPricingCache.Lock()
	modelPricingCache.values = make(map[string]ModelPricing)
	modelPricingCache.loadedAt = time.Time{}
	modelPricingCache.db = nil
	modelPricingCache.Unlock()
	InvalidatePricingCache()
}

func refreshModelPricingCache() {
	if DB == nil {
		return
	}

	modelPricingCache.RLock()
	valid := modelPricingCache.db == DB && !modelPricingCache.loadedAt.IsZero() && time.Since(modelPricingCache.loadedAt) < modelPricingCacheTTL
	modelPricingCache.RUnlock()
	if valid {
		return
	}

	modelPricingCache.Lock()
	defer modelPricingCache.Unlock()
	if modelPricingCache.db == DB && !modelPricingCache.loadedAt.IsZero() && time.Since(modelPricingCache.loadedAt) < modelPricingCacheTTL {
		return
	}
	if modelPricingCache.db != DB {
		modelPricingCache.values = make(map[string]ModelPricing)
		modelPricingCache.loadedAt = time.Time{}
		modelPricingCache.db = DB
	}

	var rows []ModelPricing
	if err := DB.Where("enabled = ?", true).Find(&rows).Error; err != nil {
		// A missing table during first boot should not make model listing panic.
		// AutoMigrate creates it during normal startup; the empty cache will be
		// retried on the next lookup.
		return
	}
	values := make(map[string]ModelPricing, len(rows))
	for _, row := range rows {
		if !isValidModelPricing(row) {
			continue
		}
		name := normalizeModelPricingName(row.ModelName)
		row.ModelName = name
		values[name] = row
	}
	modelPricingCache.values = values
	modelPricingCache.loadedAt = time.Now()
	modelPricingCache.db = DB
}

// GetModelPricing returns the enabled price schedule matching modelName.
// Exact names win. A trailing '*' matches a prefix, a leading '*' matches a
// suffix, and '*term*' matches a contained model name. This keeps wildcard
// model registrations useful while storing one canonical price row per rule.
func GetModelPricing(modelName string) (*ModelPricing, bool) {
	name := normalizeModelPricingName(modelName)
	if name == "" {
		return nil, false
	}
	refreshModelPricingCache()

	modelPricingCache.RLock()
	defer modelPricingCache.RUnlock()
	if row, ok := modelPricingCache.values[name]; ok {
		copy := row
		return &copy, true
	}

	// Pick the most specific wildcard rule. Ties are resolved by the rule's
	// longer literal portion, then lexicographically for deterministic results.
	var matched *ModelPricing
	var matchedLiteral string
	for rule, row := range modelPricingCache.values {
		if !strings.Contains(rule, "*") {
			continue
		}
		literal := strings.ReplaceAll(rule, "*", "")
		if literal == "" {
			continue
		}
		match := false
		switch {
		case strings.HasPrefix(rule, "*") && strings.HasSuffix(rule, "*"):
			match = strings.Contains(name, literal)
		case strings.HasPrefix(rule, "*"):
			match = strings.HasSuffix(name, strings.TrimPrefix(rule, "*"))
		case strings.HasSuffix(rule, "*"):
			match = strings.HasPrefix(name, strings.TrimSuffix(rule, "*"))
		}
		if !match {
			continue
		}
		if matched == nil || len(literal) > len(matchedLiteral) ||
			(len(literal) == len(matchedLiteral) && rule < matched.ModelName) {
			candidate := row
			matched = &candidate
			matchedLiteral = literal
		}
	}
	if matched == nil {
		return nil, false
	}
	copy := *matched
	return &copy, true
}

// ListModelPricings returns enabled schedules by default. Set includeDisabled
// to true for administrative views.
func ListModelPricings(includeDisabled bool) ([]ModelPricing, error) {
	if DB == nil {
		return []ModelPricing{}, nil
	}
	query := DB.Order("model_name ASC")
	if !includeDisabled {
		query = query.Where("enabled = ?", true)
	}
	var rows []ModelPricing
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	for i := range rows {
		rows[i].ModelName = normalizeModelPricingName(rows[i].ModelName)
	}
	return rows, nil
}

// SaveModelPricing creates or updates a schedule by model name. It is kept as
// a small model-level helper so admin handlers do not duplicate timestamp and
// cache invalidation rules.
func SaveModelPricing(pricing *ModelPricing) error {
	if pricing == nil {
		return errors.New("model pricing cannot be nil")
	}
	pricing.ModelName = normalizeModelPricingName(pricing.ModelName)
	if pricing.ModelName == "" {
		return gormErrInvalidModelPricingName()
	}
	if pricing.BillingType != ModelPricingBillingToken && pricing.BillingType != ModelPricingBillingRequest {
		return errors.New("model pricing billing_type must be 0 (tokens) or 1 (request)")
	}
	priceFields := []struct {
		name  string
		value float64
	}{
		{name: "input_price", value: pricing.InputPrice},
		{name: "output_price", value: pricing.OutputPrice},
		{name: "cache_read_price", value: pricing.CacheReadPrice},
		{name: "cache_write_price", value: pricing.CacheWritePrice},
		{name: "image_price", value: pricing.ImagePrice},
		{name: "audio_input_price", value: pricing.AudioInputPrice},
		{name: "audio_output_price", value: pricing.AudioOutputPrice},
		{name: "request_price", value: pricing.RequestPrice},
	}
	for _, field := range priceFields {
		if math.IsNaN(field.value) || math.IsInf(field.value, 0) || field.value < 0 {
			return fmt.Errorf("model pricing %s must be a finite non-negative value", field.name)
		}
	}
	if DB == nil {
		return errors.New("database is not initialized")
	}
	now := common.GetTimestamp()
	var existing ModelPricing
	query := DB.Where("model_name = ?", pricing.ModelName)
	if pricing.ID > 0 {
		query = DB.Where("id = ?", pricing.ID)
	}
	err := query.First(&existing).Error
	if err == nil {
		pricing.ID = existing.ID
		pricing.CreatedTime = existing.CreatedTime
	} else if pricing.ID > 0 && errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	} else {
		pricing.CreatedTime = now
	}
	pricing.UpdatedTime = now
	if err := DB.Save(pricing).Error; err != nil {
		return err
	}
	InvalidateModelPricingCache()
	return nil
}

func DeleteModelPricingByID(id int) error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	if id <= 0 {
		return errors.New("model pricing id must be positive")
	}
	result := DB.Delete(&ModelPricing{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	InvalidateModelPricingCache()
	return nil
}

// gormErrInvalidModelPricingName avoids importing the large validation stack
// into this model file while still returning a useful error to callers.
func gormErrInvalidModelPricingName() error {
	return errors.New("model pricing model_name cannot be empty")
}
