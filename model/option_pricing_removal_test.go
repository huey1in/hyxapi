package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemovedModelPricingOptionsAreRejectedAndNotLoaded(t *testing.T) {
	removedKeys := []string{
		"ModelPrice",
		"ModelRatio",
		"CompletionRatio",
		"CompletionRatioMeta",
		"CacheRatio",
		"CreateCacheRatio",
		"ImageRatio",
		"AudioRatio",
		"AudioCompletionRatio",
		"GroupGroupRatio",
		"ExposeRatioEnabled",
	}

	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	for _, key := range removedKeys {
		t.Run(key, func(t *testing.T) {
			require.ErrorIs(t, UpdateOption(key, "{}"), ErrRemovedModelPricingOption)
			require.ErrorIs(t, updateOptionMap(key, "{}"), ErrRemovedModelPricingOption)

			common.OptionMapRWMutex.RLock()
			_, loaded := common.OptionMap[key]
			common.OptionMapRWMutex.RUnlock()
			assert.False(t, loaded)
		})
	}
}

func TestGroupRatioRemainsAnActiveOption(t *testing.T) {
	assert.False(t, IsRemovedModelPricingOption("GroupRatio"))
}
