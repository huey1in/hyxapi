package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestRelayPreConsumeQuota(t *testing.T) {
	tests := []struct {
		name        string
		relayFormat types.RelayFormat
		billingType int
		standard    int
		want        int
	}{
		{
			name:        "token billed realtime establishes funding without reserving usage quota",
			relayFormat: types.RelayFormatOpenAIRealtime,
			billingType: model.ModelPricingBillingToken,
			standard:    37,
			want:        0,
		},
		{
			name:        "request billed realtime reserves its one request charge",
			relayFormat: types.RelayFormatOpenAIRealtime,
			billingType: model.ModelPricingBillingRequest,
			standard:    37,
			want:        37,
		},
		{
			name:        "non realtime token billing keeps standard reservation",
			relayFormat: types.RelayFormatOpenAI,
			billingType: model.ModelPricingBillingToken,
			standard:    37,
			want:        37,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, relayPreConsumeQuota(tt.relayFormat, tt.billingType, tt.standard))
		})
	}
}
