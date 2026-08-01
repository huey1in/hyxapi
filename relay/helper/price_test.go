package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestModelPriceHelperRejectsMissingPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: "definitely-unconfigured-model",
		UsingGroup:      "default",
	}
	_, err := ModelPriceHelper(ctx, info, 100, &types.TokenCountMeta{})

	require.Error(t, err)
}

func TestConservativeTokenPreConsumeQuotaUsesCacheWritePrice(t *testing.T) {
	pricing := &model.ModelPricing{
		BillingType:     model.ModelPricingBillingToken,
		InputPrice:      1,
		CacheReadPrice:  0.2,
		CacheWritePrice: 6,
	}

	quota := conservativeTokenPreConsumeQuota(
		pricing,
		&relaycommon.RelayInfo{},
		1000,
		&types.TokenCountMeta{},
		1,
	)

	require.Equal(t, directTokenQuota(6, 0, 1000, 0, 1), quota)
}

func TestConservativeTokenPreConsumeQuotaUsesKnownMediaPrices(t *testing.T) {
	pricing := &model.ModelPricing{
		BillingType:      model.ModelPricingBillingToken,
		InputPrice:       1,
		OutputPrice:      2,
		ImagePrice:       4,
		AudioInputPrice:  6,
		AudioOutputPrice: 8,
	}
	meta := &types.TokenCountMeta{
		Files: []*types.FileMeta{
			{FileType: types.FileTypeImage},
			{FileType: types.FileTypeAudio},
		},
		MaxTokens: 200,
	}
	info := &relaycommon.RelayInfo{OutputAudioFormat: "pcm16"}

	quota := conservativeTokenPreConsumeQuota(pricing, info, 1000, meta, 1.5)

	require.Equal(t, directTokenQuota(6, 8, 1000, 200, 1.5), quota)
}

func TestConservativeTokenPreConsumeQuotaUsesImageGenerationRatio(t *testing.T) {
	pricing := &model.ModelPricing{
		BillingType: model.ModelPricingBillingToken,
		InputPrice:  1,
		OutputPrice: 2,
		ImagePrice:  4,
	}
	meta := &types.TokenCountMeta{
		MaxTokens:       100,
		ImagePriceRatio: 2,
	}

	quota := conservativeTokenPreConsumeQuota(pricing, &relaycommon.RelayInfo{}, 1000, meta, 1)

	require.Equal(t, directTokenQuota(8, 8, 1000, 100, 1), quota)
}

func TestConservativePerCallTokenPreConsumeQuotaUsesHighestDirectPrice(t *testing.T) {
	pricing := &model.ModelPricing{
		BillingType:      model.ModelPricingBillingToken,
		InputPrice:       1,
		OutputPrice:      9,
		CacheReadPrice:   2,
		CacheWritePrice:  6,
		ImagePrice:       8,
		AudioInputPrice:  7,
		AudioOutputPrice: 10,
	}

	quota := conservativePerCallTokenPreConsumeQuota(pricing, 1.5)

	require.Equal(t, directTokenQuota(10, 0, common.PreConsumedQuota, 0, 1.5), quota)
}

func TestShouldSkipDirectFreeModelPreConsumeHonorsSetting(t *testing.T) {
	setting := operation_setting.GetQuotaSetting()
	original := setting.EnableFreeModelPreConsume
	t.Cleanup(func() { setting.EnableFreeModelPreConsume = original })
	pricing := &model.ModelPricing{BillingType: model.ModelPricingBillingToken}

	setting.EnableFreeModelPreConsume = true
	require.False(t, shouldSkipDirectFreeModelPreConsume(pricing, 1))
	require.False(t, shouldSkipDirectFreeModelPreConsume(pricing, 0))

	setting.EnableFreeModelPreConsume = false
	require.True(t, shouldSkipDirectFreeModelPreConsume(pricing, 1))
	require.True(t, shouldSkipDirectFreeModelPreConsume(pricing, 0))

	pricing.InputPrice = 1
	require.False(t, shouldSkipDirectFreeModelPreConsume(pricing, 1))
}

func TestModelPriceHelperUsesGeminiNoThinkingPriceBeforeRelay(t *testing.T) {
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ModelPricing{}))
	model.DB = db
	model.InvalidateModelPricingCache()
	t.Cleanup(func() {
		model.DB = originalDB
		model.InvalidateModelPricingCache()
	})

	settings := model_setting.GetGeminiSettings()
	originalThinkingAdapterEnabled := settings.ThinkingAdapterEnabled
	settings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { settings.ThinkingAdapterEnabled = originalThinkingAdapterEnabled })

	require.NoError(t, model.SaveModelPricing(&model.ModelPricing{
		ModelName:  "gemini-priced",
		InputPrice: 1,
		Enabled:    true,
	}))
	require.NoError(t, model.SaveModelPricing(&model.ModelPricing{
		ModelName:  "gemini-priced-nothinking",
		InputPrice: 9,
		Enabled:    true,
	}))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-priced",
		UsingGroup:      "default",
		Request: &dto.GeminiChatRequest{
			GenerationConfig: dto.GeminiChatGenerationConfig{
				ThinkingConfig: &dto.GeminiThinkingConfig{ThinkingBudget: common.GetPointer(0)},
			},
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1_000, &types.TokenCountMeta{})

	require.NoError(t, err)
	require.Equal(t, 9.0, priceData.InputPrice)
	require.Equal(t, "gemini-priced", info.OriginModelName)
}
