package model

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseModelsDevPrices(t *testing.T) {
	fixture := `{
		"z-provider": {"models": {
			"shared-model": {"name": "Shared model", "description": "A useful shared model", "cost": {"input": 9, "output": 18}},
			"invalid-model": {"cost": {"input": -1, "output": 2}},
			"empty-model": {"cost": {}}
		}},
		"a-provider": {"models": {
			"shared-model": {"name": "Shared model", "description": "A useful shared model", "cost": {"input": 1, "output": 2, "cache_read": 0.1, "cache_write": 1.25}},
			"request-only": {"cost": {"input": 0, "output": 0}}
		}}
	}`

	prices, err := ParseModelsDevPrices(strings.NewReader(fixture))
	require.NoError(t, err)
	require.Equal(t, []UpstreamModelPricing{
		{
			Provider: "a-provider",
			Pricing: ModelPricing{
				ModelName:       "shared-model",
				BillingType:     ModelPricingBillingToken,
				InputPrice:      1,
				OutputPrice:     2,
				CacheReadPrice:  0.1,
				CacheWritePrice: 1.25,
				Enabled:         true,
			},
			Description: "A useful shared model",
		},
	}, prices)
}

func TestParseModelsDevPricesPrefersOfficialProvider(t *testing.T) {
	fixture := `{
		"302ai": {"models": {"claude-sonnet-4-5": {"cost": {"input": 2, "output": 10}}}},
		"anthropic": {"models": {"claude-sonnet-4-5": {"cost": {"input": 3, "output": 15}}}}
	}`

	prices, err := ParseModelsDevPrices(strings.NewReader(fixture))

	require.NoError(t, err)
	require.Len(t, prices, 1)
	require.Equal(t, "anthropic", prices[0].Provider)
	require.Equal(t, 3.0, prices[0].Pricing.InputPrice)
}

func TestFilterUpstreamModelPrices(t *testing.T) {
	prices := []UpstreamModelPricing{
		{Provider: "openai", Pricing: ModelPricing{ModelName: "gpt-enabled", InputPrice: 1}},
		{Provider: "anthropic", Pricing: ModelPricing{ModelName: "claude-disabled", InputPrice: 3}},
	}

	filtered := FilterUpstreamModelPrices(prices, []string{"gpt-enabled", "local-only", "gpt-enabled"})

	require.Equal(t, []UpstreamModelPricing{prices[0]}, filtered)
}

func TestFilterUpstreamModelPricesFallsBackToBaseModelForTimestampedThinkingVariant(t *testing.T) {
	prices := []UpstreamModelPricing{
		{Provider: "anthropic", Pricing: ModelPricing{ModelName: "claude-sonnet-4-5", InputPrice: 3, OutputPrice: 15, CacheReadPrice: 0.3, CacheWritePrice: 3.75}},
		{Provider: "anthropic", Pricing: ModelPricing{ModelName: "claude-sonnet-4-5-20250929-thinking", InputPrice: 3, OutputPrice: 15}},
	}

	filtered := FilterUpstreamModelPrices(prices, []string{"claude-sonnet-4-5-20250929-thinking"})

	require.Equal(t, []UpstreamModelPricing{
		{Provider: "anthropic", Pricing: ModelPricing{ModelName: "claude-sonnet-4-5-20250929-thinking", InputPrice: 3, OutputPrice: 15, CacheReadPrice: 0.3, CacheWritePrice: 3.75}},
	}, filtered)
}

func TestFetchModelsDevPricesRejectsNonSuccessResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}))
	t.Cleanup(server.Close)

	_, err := FetchModelsDevPrices(server.Client(), server.URL)

	require.ErrorContains(t, err, "502")
}

func TestFetchModelsDevPricesUsesBoundedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", int(maxModelsDevResponseBytes+1))))
	}))
	t.Cleanup(server.Close)

	client := server.Client()
	client.Timeout = time.Second
	_, err := FetchModelsDevPrices(client, server.URL)

	require.ErrorContains(t, err, "too large")
}

func TestApplyModelPricingSyncUpsertsSelectedEnabledModels(t *testing.T) {
	truncateTables(t)
	require.NoError(t, SaveModelPricing(&ModelPricing{
		ModelName: "existing-model", InputPrice: 10, Enabled: true,
	}))
	prices := []UpstreamModelPricing{
		{Provider: "provider", Pricing: ModelPricing{ModelName: "existing-model", InputPrice: 1, Enabled: true}},
		{Provider: "provider", Pricing: ModelPricing{ModelName: "new-model", InputPrice: 2, Enabled: true}},
		{Provider: "provider", Pricing: ModelPricing{ModelName: "not-selected", InputPrice: 3, Enabled: true}},
	}

	saved, err := ApplyModelPricingSync(prices, []string{"existing-model", "new-model"}, []string{"existing-model", "new-model", "not-selected"})

	require.NoError(t, err)
	require.Equal(t, 2, saved)
	rows, err := ListModelPricings(true)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, 1.0, rows[0].InputPrice)
	require.Equal(t, "new-model", rows[1].ModelName)
}

func TestApplyModelPricingSyncRollsBackWhenSelectionIsUnsupported(t *testing.T) {
	truncateTables(t)
	prices := []UpstreamModelPricing{
		{Provider: "provider", Pricing: ModelPricing{ModelName: "enabled-model", InputPrice: 1, Enabled: true}},
	}

	_, err := ApplyModelPricingSync(prices, []string{"enabled-model", "unsupported-model"}, []string{"enabled-model"})

	require.ErrorContains(t, err, "unsupported-model")
	rows, listErr := ListModelPricings(true)
	require.NoError(t, listErr)
	require.Empty(t, rows)
}

func TestApplyModelPricingSyncFillsMissingDescriptionAndPreservesManualDescription(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}))
	require.NoError(t, DB.Where("model_name IN ?", []string{"empty-description", "manual-description"}).Delete(&Model{}).Error)
	require.NoError(t, DB.Create(&Model{ModelName: "empty-description", Status: 1}).Error)
	require.NoError(t, DB.Create(&Model{ModelName: "manual-description", Description: "管理员介绍", Status: 1}).Error)
	prices := []UpstreamModelPricing{
		{Provider: "provider", Description: "上游介绍 A", Pricing: ModelPricing{ModelName: "empty-description", InputPrice: 1, Enabled: true}},
		{Provider: "provider", Description: "上游介绍 B", Pricing: ModelPricing{ModelName: "manual-description", InputPrice: 2, Enabled: true}},
	}

	_, err := ApplyModelPricingSync(prices, []string{"empty-description", "manual-description"}, []string{"empty-description", "manual-description"})

	require.NoError(t, err)
	var metadata []Model
	require.NoError(t, DB.Where("model_name IN ?", []string{"empty-description", "manual-description"}).Order("model_name").Find(&metadata).Error)
	require.Len(t, metadata, 2)
	require.Equal(t, "上游介绍 A", metadata[0].Description)
	require.Equal(t, "管理员介绍", metadata[1].Description)
}

func TestApplyModelPricingSyncCreatesMetadataForEnabledModel(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Model{}))
	require.NoError(t, DB.Where("model_name = ?", "new-described-model").Delete(&Model{}).Error)
	prices := []UpstreamModelPricing{
		{Provider: "provider", Description: "New model description", Pricing: ModelPricing{ModelName: "new-described-model", InputPrice: 1, Enabled: true}},
	}

	_, err := ApplyModelPricingSync(prices, []string{"new-described-model"}, []string{"new-described-model"})

	require.NoError(t, err)
	var metadata Model
	require.NoError(t, DB.Where("model_name = ?", "new-described-model").First(&metadata).Error)
	require.Equal(t, "New model description", metadata.Description)
	require.Equal(t, 1, metadata.Status)
}
