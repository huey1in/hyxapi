package controller

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildModelPricingSyncPreviewReturnsOnlyNewAndChangedPrices(t *testing.T) {
	local := []model.ModelPricing{
		{ID: 1, ModelName: "same-model", InputPrice: 1, OutputPrice: 2, Enabled: true},
		{ID: 2, ModelName: "changed-model", InputPrice: 9, OutputPrice: 2, Enabled: true},
	}
	upstream := []model.UpstreamModelPricing{
		{Provider: "provider", Pricing: model.ModelPricing{ModelName: "same-model", InputPrice: 1, OutputPrice: 2, Enabled: true}},
		{Provider: "provider", Pricing: model.ModelPricing{ModelName: "changed-model", InputPrice: 1, OutputPrice: 2, Enabled: true}},
		{Provider: "provider", Pricing: model.ModelPricing{ModelName: "new-model", InputPrice: 3, OutputPrice: 6, Enabled: true}},
	}

	preview := buildModelPricingSyncPreview(local, upstream, nil)

	require.Len(t, preview, 2)
	require.Equal(t, "changed-model", preview[0].ModelName)
	require.Equal(t, "changed", preview[0].Status)
	require.Equal(t, 9.0, preview[0].Local.InputPrice)
	require.Equal(t, 1.0, preview[0].Upstream.InputPrice)
	require.Equal(t, "new-model", preview[1].ModelName)
	require.Equal(t, "new", preview[1].Status)
	require.Nil(t, preview[1].Local)
	require.Zero(t, preview[1].Upstream.ID)
}

func TestBuildModelPricingSyncPreviewIncludesDescriptionOnlyChange(t *testing.T) {
	local := []model.ModelPricing{{ModelName: "described-model", InputPrice: 1, Enabled: true}}
	upstream := []model.UpstreamModelPricing{{
		Provider: "provider", Description: "Upstream description",
		Pricing: model.ModelPricing{ModelName: "described-model", InputPrice: 1, Enabled: true},
	}}

	preview := buildModelPricingSyncPreview(local, upstream, map[string]string{"described-model": ""})

	require.Len(t, preview, 1)
	require.Equal(t, "description", preview[0].Status)
	require.Equal(t, "add", preview[0].DescriptionAction)
}

func TestSelectModelPricingProxyPrefersEnvironment(t *testing.T) {
	request, err := http.NewRequest(http.MethodGet, modelsDevPricingURL, nil)
	require.NoError(t, err)
	environmentProxy, err := url.Parse("http://environment-proxy:8080")
	require.NoError(t, err)

	selected, err := selectModelPricingProxy(request, func(*http.Request) (*url.URL, error) {
		return environmentProxy, nil
	}, "127.0.0.1:7890")

	require.NoError(t, err)
	require.Equal(t, environmentProxy.String(), selected.String())
}

func TestSelectModelPricingProxyFallsBackToWindowsHTTPSProxy(t *testing.T) {
	request, err := http.NewRequest(http.MethodGet, modelsDevPricingURL, nil)
	require.NoError(t, err)

	selected, err := selectModelPricingProxy(request, func(*http.Request) (*url.URL, error) {
		return nil, nil
	}, "http=127.0.0.1:7889;https=127.0.0.1:7890")

	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:7890", selected.String())
}

func TestSelectModelPricingProxySupportsSingleWindowsProxy(t *testing.T) {
	request, err := http.NewRequest(http.MethodGet, modelsDevPricingURL, nil)
	require.NoError(t, err)

	selected, err := selectModelPricingProxy(request, func(*http.Request) (*url.URL, error) {
		return nil, nil
	}, "127.0.0.1:7890")

	require.NoError(t, err)
	require.Equal(t, "http://127.0.0.1:7890", selected.String())
}
