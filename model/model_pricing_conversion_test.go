package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/require"
)

func TestPricingConversionRejectsSpecialRoutesForBothPriceSources(t *testing.T) {
	isolatePricingConfig(t)
	cases := []struct {
		name        string
		channelType int
		mapping     string
		metadata    string
		nameRule    int
		reason      string
	}{
		{name: "task", channelType: constant.ChannelTypeTaskPlugin, reason: "Task pricing"},
		{name: "video", channelType: constant.ChannelTypeSora, reason: "Video pricing"},
		{name: "realtime", channelType: constant.ChannelTypeOpenAI, reason: "Realtime pricing"},
		{name: "mapped", channelType: constant.ChannelTypeOpenAI, mapping: `{"conversion-mapped":"middle","middle":"gpt-realtime"}`, reason: "Realtime pricing"},
		{name: "cycle", channelType: constant.ChannelTypeOpenAI, mapping: `{"conversion-cycle":"middle","middle":"conversion-cycle"}`, reason: "could not be verified"},
		{name: "invalid-mapping", channelType: constant.ChannelTypeOpenAI, mapping: `{`, reason: "could not be verified"},
		{name: "video-array", metadata: fmt.Sprintf(`[" %s "]`, constant.EndpointTypeOpenAIVideo), reason: "Video pricing"},
		{name: "video-map", metadata: fmt.Sprintf(`{"%s":{"path":"/videos"}}`, constant.EndpointTypeOpenAIVideo), reason: "Video pricing"},
		{name: "video-prefix", nameRule: NameRulePrefix, metadata: fmt.Sprintf(`["%s"]`, constant.EndpointTypeOpenAIVideo), reason: "Video pricing"},
		{name: "bad-metadata", metadata: `[42]`, reason: "could not be verified"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			name := "conversion-" + tc.name
			require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: name, Enabled: true, InputPrice: 2}))
			if tc.channelType != 0 {
				channel := Channel{Type: tc.channelType, Status: common.ChannelStatusEnabled, Models: name, ModelMapping: &tc.mapping}
				require.NoError(t, DB.Create(&channel).Error)
				require.NoError(t, DB.Create(&Ability{Group: "default", Model: name, ChannelId: channel.Id, Enabled: true}).Error)
				t.Cleanup(func() { DB.Where("channel_id = ?", channel.Id).Delete(&Ability{}) })
			}
			if tc.metadata != "" {
				modelName := name
				if tc.nameRule == NameRulePrefix {
					modelName = "conversion-video-pref"
				}
				row := &Model{ModelName: modelName, NameRule: tc.nameRule, Endpoints: tc.metadata}
				require.NoError(t, DB.Create(row).Error)
				t.Cleanup(func() { DB.Unscoped().Delete(row) })
			}
			for _, direct := range []bool{false, true} {
				var preview *ModelPricingConversion
				var err error
				if direct {
					preview, err = PreviewDirectModelPricingConversion(name)
				} else {
					preview, err = PreviewModelPricingConversion(name, PricingValues{"ModelPrice": float64(1)})
				}
				require.NoError(t, err)
				require.Contains(t, preview.UnsupportedReason, tc.reason, "direct=%v", direct)
				require.Empty(t, preview.Expression)
			}
		})
	}
}

func TestDirectPricingConversionPreservesMappedImageCount(t *testing.T) {
	isolatePricingConfig(t)
	const name = "conversion-image-alias"
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: name, Enabled: true,
		BillingType: ModelPricingBillingRequest, RequestPrice: 0.04}))
	mapping := `{"conversion-image-alias":"middle-image","middle-image":"private-image"}`
	channel := &Channel{Type: constant.ChannelTypeOpenAI, Models: name, ModelMapping: &mapping}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: name, ChannelId: channel.Id}).Error)
	metadata := &Model{ModelName: "private-image", Endpoints: fmt.Sprintf(`[" %s "]`, constant.EndpointTypeImageGeneration)}
	require.NoError(t, DB.Create(metadata).Error)
	t.Cleanup(func() {
		DB.Where("channel_id = ?", channel.Id).Delete(&Ability{})
		DB.Unscoped().Delete(metadata)
	})
	preview, err := PreviewDirectModelPricingConversion(name)
	require.NoError(t, err)
	require.Empty(t, preview.UnsupportedReason)
	require.True(t, preview.BillingDetails.ImageCount)
	count := 3
	cost, _, err := billingexpr.RunExprWithRequest(preview.Expression, billingexpr.TokenParams{}, billingexpr.RequestInput{ImageCount: &count})
	require.NoError(t, err)
	// The relay expression engine returns millionth-dollar quota units.
	require.InDelta(t, 0.12, cost/1_000_000, 1e-12)
}

func TestWildcardDirectConversionInspectsCoveredRoutesAndHonorsSpecificPrices(t *testing.T) {
	isolatePricingConfig(t)
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: "wild-route-*", Enabled: true, InputPrice: 2}))
	channel := &Channel{Type: constant.ChannelTypeTaskPlugin, Models: "wild-route-video"}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "wild-route-video", ChannelId: channel.Id, Enabled: true}).Error)
	t.Cleanup(func() { DB.Where("channel_id = ?", channel.Id).Delete(&Ability{}) })
	preview, err := PreviewDirectModelPricingConversion("wild-route-*")
	require.NoError(t, err)
	require.Contains(t, preview.UnsupportedReason, "Task pricing")
	require.Empty(t, preview.Expression)
	// A more specific schedule is not changed when the wildcard is converted.
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: "wild-route-video", Enabled: true, RequestPrice: 0.2}))
	preview, err = PreviewDirectModelPricingConversion("wild-route-*")
	require.NoError(t, err)
	require.Empty(t, preview.UnsupportedReason)
	require.NotEmpty(t, preview.Expression)
}

func TestWildcardDirectConversionRefusesDifferentImageMultipliers(t *testing.T) {
	isolatePricingConfig(t)
	require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: "dall-e-*", Enabled: true, BillingType: ModelPricingBillingRequest, RequestPrice: 0.04}))
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: "dall-e-3", Enabled: true}).Error)
	t.Cleanup(func() { DB.Where("model = ?", "dall-e-3").Delete(&Ability{}) })
	preview, err := PreviewDirectModelPricingConversion("dall-e-*")
	require.NoError(t, err)
	require.Contains(t, preview.UnsupportedReason, "different image pricing rules")
	require.Empty(t, preview.Expression)
}
