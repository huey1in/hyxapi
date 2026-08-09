package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type recordingRealtimeBilling struct {
	preConsumed int
	settledWith []int
}

func (b *recordingRealtimeBilling) Settle(actualQuota int) error {
	b.settledWith = append(b.settledWith, actualQuota)
	return nil
}

func (b *recordingRealtimeBilling) Refund(*gin.Context) {}

func (b *recordingRealtimeBilling) NeedsRefund() bool { return false }

func (b *recordingRealtimeBilling) GetPreConsumedQuota() int { return b.preConsumed }

func (b *recordingRealtimeBilling) Reserve(_ int) error { return nil }

func newRealtimePricingTestContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	return ctx
}

func TestSettleRealtimeBillingSettlesOneRequestCharge(t *testing.T) {
	billing := &recordingRealtimeBilling{preConsumed: 37}
	info := &relaycommon.RelayInfo{
		Billing:   billing,
		UserQuota: 100_000,
		PriceData: types.PriceData{
			BillingType: model.ModelPricingBillingRequest,
		},
	}

	err := settleRealtimeBilling(newRealtimePricingTestContext(), info, 37)

	require.NoError(t, err)
	require.Equal(t, []int{37}, billing.settledWith)
}

func TestSettleRealtimeBillingReleasesTokenBillingFundingReservation(t *testing.T) {
	billing := &recordingRealtimeBilling{preConsumed: 1}
	info := &relaycommon.RelayInfo{
		Billing: billing,
		PriceData: types.PriceData{
			BillingType: model.ModelPricingBillingToken,
		},
	}

	err := settleRealtimeBilling(newRealtimePricingTestContext(), info, 37)

	require.NoError(t, err)
	require.Equal(t, []int{0}, billing.settledWith)
}

func TestFinalRealtimeQuotaUsesSuccessfullyChargedTokenChunks(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RealtimeConsumedQuota: 2,
		PriceData: types.PriceData{
			BillingType: model.ModelPricingBillingToken,
		},
	}

	require.Equal(t, 2, finalRealtimeQuota(info, 1))
}

func TestFinalRealtimeQuotaKeepsRequestPrice(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RealtimeConsumedQuota: 99,
		PriceData: types.PriceData{
			BillingType: model.ModelPricingBillingRequest,
		},
	}

	require.Equal(t, 37, finalRealtimeQuota(info, 37))
}
