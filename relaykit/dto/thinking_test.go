package dto

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestThinkingRetainsBindingAndFutureFields(t *testing.T) {
	const raw = `{"type":"adaptive","block_binding":{"mode":"on"},"future":{"enabled":true}}`
	var thinking Thinking
	require.NoError(t, json.Unmarshal([]byte(raw), &thinking))
	got, err := json.Marshal(thinking)
	require.NoError(t, err)
	require.JSONEq(t, raw, string(got))
}
