package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelInfoScanSupportsTextBinaryAndLegacyEmptyValues(t *testing.T) {
	for _, value := range []any{`{"is_multi_key":true,"multi_key_size":2}`, []byte(`{"is_multi_key":true,"multi_key_size":2}`)} {
		var info ChannelInfo
		require.NoError(t, info.Scan(value))
		require.True(t, info.IsMultiKey)
		require.Equal(t, 2, info.MultiKeySize)
	}
	for _, value := range []any{nil, "", "  ", []byte{}, "null"} {
		info := ChannelInfo{IsMultiKey: true, MultiKeySize: 7}
		require.NoError(t, info.Scan(value))
		require.Equal(t, ChannelInfo{}, info)
	}
	var info ChannelInfo
	require.Error(t, info.Scan(`{"is_multi_key":`))
	require.Error(t, info.Scan(3))
}
