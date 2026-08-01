package model

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestModelPricingSQLiteMigrationIsRepeatable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ModelPricing{}))
	require.NoError(t, db.AutoMigrate(&ModelPricing{}))
}

func TestSaveModelPricingRejectsNil(t *testing.T) {
	truncateTables(t)

	err := SaveModelPricing(nil)

	require.Error(t, err)
}

func TestSaveModelPricingUpdatesExistingModel(t *testing.T) {
	truncateTables(t)

	pricing := &ModelPricing{
		ModelName:   "gpt-test",
		BillingType: ModelPricingBillingToken,
		InputPrice:  1.25,
		Enabled:     true,
	}
	require.NoError(t, SaveModelPricing(pricing))
	firstID := pricing.ID

	updated := &ModelPricing{
		ModelName:   "gpt-test",
		BillingType: ModelPricingBillingToken,
		InputPrice:  2.5,
		OutputPrice: 7.5,
		Enabled:     true,
	}
	require.NoError(t, SaveModelPricing(updated))

	assert.Equal(t, firstID, updated.ID)
	var count int64
	require.NoError(t, DB.Model(&ModelPricing{}).Where("model_name = ?", "gpt-test").Count(&count).Error)
	assert.EqualValues(t, 1, count)

	stored, ok := GetModelPricing("gpt-test")
	require.True(t, ok)
	assert.Equal(t, 2.5, stored.InputPrice)
	assert.Equal(t, 7.5, stored.OutputPrice)
}

func TestSaveModelPricingRejectsUnknownUpdateID(t *testing.T) {
	truncateTables(t)

	err := SaveModelPricing(&ModelPricing{
		ID:          999,
		ModelName:   "unexpected-insert",
		BillingType: ModelPricingBillingToken,
		InputPrice:  1,
		Enabled:     true,
	})

	require.Error(t, err)
	var count int64
	require.NoError(t, DB.Model(&ModelPricing{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestSaveModelPricingOwnsTimestamps(t *testing.T) {
	truncateTables(t)

	beforeCreate := common.GetTimestamp()
	pricing := &ModelPricing{
		ModelName:   "server-timestamp-model",
		BillingType: ModelPricingBillingToken,
		InputPrice:  1,
		Enabled:     true,
		CreatedTime: 1,
		UpdatedTime: 2,
	}
	require.NoError(t, SaveModelPricing(pricing))
	afterCreate := common.GetTimestamp()

	require.GreaterOrEqual(t, pricing.CreatedTime, beforeCreate)
	require.LessOrEqual(t, pricing.CreatedTime, afterCreate)
	require.GreaterOrEqual(t, pricing.UpdatedTime, beforeCreate)
	require.LessOrEqual(t, pricing.UpdatedTime, afterCreate)
	createdTime := pricing.CreatedTime

	beforeUpdate := common.GetTimestamp()
	updated := &ModelPricing{
		ModelName:   pricing.ModelName,
		BillingType: ModelPricingBillingToken,
		InputPrice:  2,
		Enabled:     true,
		CreatedTime: 3,
		UpdatedTime: 4,
	}
	require.NoError(t, SaveModelPricing(updated))
	afterUpdate := common.GetTimestamp()

	require.Equal(t, createdTime, updated.CreatedTime)
	require.GreaterOrEqual(t, updated.UpdatedTime, beforeUpdate)
	require.LessOrEqual(t, updated.UpdatedTime, afterUpdate)
}

func TestGetModelPricingPrefersExactThenMostSpecificWildcard(t *testing.T) {
	truncateTables(t)

	rows := []ModelPricing{
		{ModelName: "gpt-*", InputPrice: 1, Enabled: true},
		{ModelName: "gpt-4*", InputPrice: 2, Enabled: true},
		{ModelName: "gpt-4o", InputPrice: 3, Enabled: true},
	}
	for i := range rows {
		require.NoError(t, SaveModelPricing(&rows[i]))
	}

	exact, ok := GetModelPricing("gpt-4o")
	require.True(t, ok)
	assert.Equal(t, 3.0, exact.InputPrice)

	wildcard, ok := GetModelPricing("gpt-4.1")
	require.True(t, ok)
	assert.Equal(t, "gpt-4*", wildcard.ModelName)
	assert.Equal(t, 2.0, wildcard.InputPrice)
}

func TestGetModelPricingIgnoresDisabledRows(t *testing.T) {
	truncateTables(t)

	require.NoError(t, SaveModelPricing(&ModelPricing{
		ModelName:  "disabled-model",
		InputPrice: 1,
		Enabled:    false,
	}))

	_, ok := GetModelPricing("disabled-model")
	assert.False(t, ok)
}

func TestGetModelPricingIgnoresMalformedDatabaseRows(t *testing.T) {
	truncateTables(t)

	rows := []ModelPricing{
		{ModelName: "invalid-billing-type", BillingType: 99, InputPrice: 1, Enabled: true},
		{ModelName: "negative-input-price", BillingType: ModelPricingBillingToken, InputPrice: -1, Enabled: true},
		{ModelName: "non-finite-output-price", BillingType: ModelPricingBillingToken, OutputPrice: math.Inf(1), Enabled: true},
	}
	for i := range rows {
		require.NoError(t, DB.Create(&rows[i]).Error)
	}
	InvalidateModelPricingCache()

	for _, row := range rows {
		_, ok := GetModelPricing(row.ModelName)
		assert.Falsef(t, ok, "malformed row %s must not be available for billing", row.ModelName)
	}
}

func TestListModelPricingsDoesNotNormalizeUnknownBillingType(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&ModelPricing{
		ModelName:   "invalid-billing-type",
		BillingType: 99,
		InputPrice:  1,
		Enabled:     true,
	}).Error)

	rows, err := ListModelPricings(true)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, 99, rows[0].BillingType)
	assert.Empty(t, rows[0].BillingTypeName())
}
