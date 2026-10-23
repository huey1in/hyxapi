package service

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEpusdtSignatureMatchesUpstreamV2Vector(t *testing.T) {
	fields := map[string]any{"signature": "ignored", "pid": "1000", "empty": "", "nil": nil, "name": "VIP", "amount": 100}
	signature, err := EpusdtSignature(fields, "test-secret")
	require.NoError(t, err)
	require.Equal(t, "ced9141fab53a83d1178f903e7c22d8a2a7033520f31e319934e92455a008b6c", signature)
	fields["signature"] = signature
	require.True(t, VerifyEpusdtSignature(fields, "test-secret"))
	fields["amount"] = 101
	require.False(t, VerifyEpusdtSignature(fields, "test-secret"))
	require.False(t, VerifyEpusdtSignature(fields, ""))
}

func TestEpusdtSignatureCanonicalizesJSONNumbers(t *testing.T) {
	first, err := EpusdtSignature(map[string]any{"amount": json.Number("1e2")}, "secret")
	require.NoError(t, err)
	second, err := EpusdtSignature(map[string]any{"amount": 100}, "secret")
	require.NoError(t, err)
	require.Equal(t, first, second)
	_, err = EpusdtSignature(map[string]any{"amount": map[string]any{}}, "secret")
	require.Error(t, err)
}
