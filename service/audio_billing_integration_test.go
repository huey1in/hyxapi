package service

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestAudioExpressionSettlesWalletAndRecordsActivePrice(t *testing.T) {
	for _, tc := range []struct {
		name       string
		expression string
		usage      *dto.Usage
		quota      int
	}{
		{"modalities", `tier("audio", p * 2 + c * 4 + ai * 8 + ao * 16)`,
			&dto.Usage{PromptTokens: 1000, CompletionTokens: 200, TotalTokens: 1200,
				PromptTokensDetails:    dto.InputTokenDetails{AudioTokens: 400},
				CompletionTokenDetails: dto.OutputTokenDetails{AudioTokens: 100}}, 3200},
		{"fixed_without_usage", `tier("request", fixed(0.02))`, &dto.Usage{}, 10000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupTieredSettlementDB(t)
			previousLogs, previousEnabled, previousBatch := model.LOG_DB, common.LogConsumeEnabled, common.BatchUpdateEnabled
			model.LOG_DB, common.LogConsumeEnabled, common.BatchUpdateEnabled = model.DB, true, false
			t.Cleanup(func() {
				model.LOG_DB, common.LogConsumeEnabled, common.BatchUpdateEnabled = previousLogs, previousEnabled, previousBatch
			})
			require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Log{}))
			const userID, balance = 800, 1_000_000
			seedTieredSettlementUser(t, userID, balance)
			seedToken(t, userID, userID, "audio-billing-key", balance)
			channel := &model.Channel{Name: "audio-billing-test"}
			require.NoError(t, model.DB.Create(channel).Error)
			ctx := newTextQuotaTestContext()
			ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			ctx.Set(string(constant.ContextKeyLocalCountTokens), true)
			info := makeRelayInfo(tc.expression, 1, 1000, 200)
			info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: channel.Id}
			info.UserId = userID
			info.OriginModelName, info.StartTime = "audio-expression", time.Now()
			info.TokenId, info.TokenKey, info.ForcePreConsume = userID, "audio-billing-key", true
			info.UserSetting = dto.UserSetting{BillingPreference: "wallet_only", QuotaWarningEnabled: common.GetPointer(false)}
			info.PriceData = types.PriceData{BillingType: model.ModelPricingBillingToken,
				BillingMode: "tiered_expr", GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1}}
			require.Nil(t, PreConsumeBilling(ctx, 20_000, info))
			PostAudioConsumeQuota(ctx, info, tc.usage, "")
			quota, err := model.GetUserQuota(userID, false)
			require.NoError(t, err)
			require.Equal(t, balance-tc.quota, quota)
			token, err := model.GetTokenById(userID)
			require.NoError(t, err)
			require.Equal(t, balance-tc.quota, token.RemainQuota)
			var log model.Log
			require.NoError(t, model.DB.Where("user_id = ?", userID).First(&log).Error)
			require.Equal(t, tc.quota, log.Quota)
			var other map[string]any
			require.NoError(t, json.Unmarshal([]byte(log.Other), &other))
			require.Equal(t, "tiered_expr", other["billing_mode"])
			require.Equal(t, "local", other["admin_info"].(map[string]any)["usage_billing_path"])
		})
	}
}
