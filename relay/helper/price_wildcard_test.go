package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestWildcardPriceConversionSelectsTheSameRuleForRequestsAndDiscovery(t *testing.T) {
	previousDB := model.DB
	saved := config.GlobalConfig.ExportAllConfigs()
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.ModelPricing{}))
	model.DB = database
	model.InvalidateModelPricingCache()
	t.Cleanup(func() {
		model.DB = previousDB
		model.InvalidateModelPricingCache()
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
		sqlDB, err := database.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, model.SaveModelPricing(&model.ModelPricing{ModelName: "wildcard-text-*", Enabled: true, InputPrice: 9}))
	for _, tc := range []struct {
		name, modes, expressions, billingName, expression string
		usable                                            bool
	}{
		{"unchanged direct", `{}`, `{}`, "wildcard-text-one", "", true},
		{"converted wildcard", `{"wildcard-text-*":"tiered_expr"}`, `{"wildcard-text-*":"tier(\"converted\", p * 2)"}`, "wildcard-text-*", `tier("converted", p * 2)`, true},
		{"exact override", `{"wildcard-text-*":"tiered_expr","wildcard-text-one":"tiered_expr"}`, `{"wildcard-text-*":"tier(\"converted\", p * 2)","wildcard-text-one":"tier(\"specific\", p * 3)"}`, "wildcard-text-one", `tier("specific", p * 3)`, true},
		{"blank conversion", `{"wildcard-text-*":"tiered_expr"}`, `{"wildcard-text-*":""}`, "wildcard-text-*", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
				"billing_setting.billing_mode": tc.modes, "billing_setting.billing_expr": tc.expressions,
			}))
			require.Equal(t, tc.usable, HasModelBillingConfig("wildcard-text-one"))
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{OriginModelName: "wildcard-text-one", UsingGroup: "default", UserGroup: "default"}
			price, err := ModelPriceHelper(c, info, 1000, &types.TokenCountMeta{})
			require.Equal(t, tc.billingName, info.PricingModelName)
			require.Equal(t, "wildcard-text-one", info.OriginModelName)
			if !tc.usable {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tc.expression == "" {
				require.Nil(t, info.TieredBillingSnapshot)
				require.Equal(t, float64(9), price.InputPrice)
			} else {
				require.NotNil(t, info.TieredBillingSnapshot)
				require.Equal(t, tc.expression, info.TieredBillingSnapshot.ExprString)
			}
		})
	}
}
