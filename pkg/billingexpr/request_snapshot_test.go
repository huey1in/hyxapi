package billingexpr

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTaskRequestContextPreservesConditionsTimeAndUpdatedUsageAfterSerialization(t *testing.T) {
	expression := `tier("night", u("seconds") * 0.1) * (param("service_tier") == "flex" ? 0.5 : 1) * (header("x-plan") == "vip" ? 0.8 : 1) * (hour("UTC") >= 21 || hour("UTC") < 6 ? 0.5 : 1)`
	at := time.Date(2026, 1, 2, 23, 30, 0, 0, time.UTC)
	input := RequestInput{Body: []byte(`{"service_tier":"flex","prompt":"private prompt"}`),
		Headers: map[string]string{"X-Plan": " vip ", "Authorization": "private credential"}}
	frozen, err := FreezeTaskRequestContext(expression, input, at)
	require.NoError(t, err)
	snapshot := &BillingSnapshot{ExprString: expression, ExprHash: ExprHashString(expression), GroupRatio: 1,
		QuotaPerUnit: 500000, TaskUsageBilling: true, RequestContext: frozen}
	encoded, err := json.Marshal(snapshot)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "private prompt")
	require.NotContains(t, string(encoded), "private credential")
	var persisted BillingSnapshot
	require.NoError(t, json.Unmarshal(encoded, &persisted))
	// Completion receives fresh usage, but no live HTTP context. Caller-supplied
	// request values cannot override the saved quote's conditions or time.
	for _, quantity := range []float64{5, 10} {
		result, err := ComputeTieredQuotaWithRequest(&persisted, TokenParams{}, RequestInput{Usage: map[string]any{"seconds": quantity},
			Body: []byte(`{"service_tier":"standard"}`), Headers: map[string]string{"x-plan": "regular"}})
		require.NoError(t, err)
		require.Equal(t, int(quantity*10000), result.ActualQuotaAfterGroup)
		require.Len(t, result.RequestRules, 3)
		for _, rule := range result.RequestRules {
			require.True(t, rule.Matched)
		}
	}
}

func TestTaskRequestContextKeepsNestedBooleanArrayLengthAndMissingValues(t *testing.T) {
	expression := `tier("base", u("units") * 0.1) * (param("options.enabled") == true && param("items.#") == 2 && param("missing") == nil ? 0.5 : 1)`
	frozen, err := FreezeTaskRequestContext(expression, RequestInput{Body: []byte(`{"options":{"enabled":true},"items":[1,2]}`)}, time.Now())
	require.NoError(t, err)
	cost, _, err := RunExprWithRequest(expression, TokenParams{}, RequestInput{Frozen: frozen, Usage: map[string]any{"units": float64(10)}})
	require.NoError(t, err)
	require.InDelta(t, 0.5, cost, 1e-12)
	require.Contains(t, frozen.Params, "missing")
	require.Nil(t, frozen.Params["missing"])
}

func TestTaskRequestContextRejectsUnfreezableOrOversizedConditions(t *testing.T) {
	_, err := FreezeTaskRequestContext(`tier("base", 1) * (param(u("field")) == "vip" ? 0.5 : 1)`, RequestInput{}, time.Now())
	require.ErrorContains(t, err, "string literals")
	_, err = FreezeTaskRequestContext(`tier("base", 1) * (param("options") != nil ? 0.5 : 1)`,
		RequestInput{Body: []byte(`{"options":"` + strings.Repeat("x", 64*1024) + `"}`)}, time.Now())
	require.ErrorContains(t, err, "64 KiB")
	frozen, err := FreezeTaskRequestContext(`tier("base", u("units") * 0.1)`, RequestInput{}, time.Now())
	require.NoError(t, err)
	require.Nil(t, frozen)
}
