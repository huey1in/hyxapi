package model

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func channelInfoFixtures() map[string]ChannelInfo {
	return map[string]ChannelInfo{
		"single_key": {},
		"multi_key": {
			IsMultiKey:             true,
			MultiKeySize:           2,
			MultiKeyStatusList:     map[int]int{0: 1, 1: 2},
			MultiKeyDisabledReason: map[int]string{1: "quota exhausted"},
			MultiKeyDisabledTime:   map[int]int64{1: 123},
			MultiKeyPollingIndex:   1,
			MultiKeyMode:           constant.MultiKeyModePolling,
		},
	}
}

func TestChannelInfoValueReturnsJSONText(t *testing.T) {
	for name, info := range channelInfoFixtures() {
		t.Run(name, func(t *testing.T) {
			value, err := info.Value()
			require.NoError(t, err)
			text, ok := value.(string)
			require.True(t, ok, "PostgreSQL simple protocol encodes []byte as bytea, not JSON")
			var stored ChannelInfo
			require.NoError(t, stored.Scan(text))
			require.Equal(t, info, stored)
		})
	}
}

func TestChannelInfoPostgreSQLSimpleProtocol(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not configured")
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	require.NoError(t, err)
	pool, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, pool.Close()) })
	tx := db.Begin()
	require.NoError(t, tx.Error)
	t.Cleanup(func() { require.NoError(t, tx.Rollback().Error) })
	require.NoError(t, tx.Exec("CREATE TEMP TABLE channel_info_json_test (id bigserial PRIMARY KEY, channel_info json)").Error)
	for name, info := range channelInfoFixtures() {
		t.Run(name, func(t *testing.T) {
			channel := Channel{ChannelInfo: info}
			require.NoError(t, tx.Table("channel_info_json_test").Select("ChannelInfo").Create(&channel).Error)
			var stored Channel
			require.NoError(t, tx.Table("channel_info_json_test").First(&stored, channel.Id).Error)
			require.Equal(t, info, stored.ChannelInfo)
			stored.ChannelInfo.MultiKeyPollingIndex++
			require.NoError(t, tx.Table("channel_info_json_test").Where("id = ?", channel.Id).Update("channel_info", stored.ChannelInfo).Error)
			var updated Channel
			require.NoError(t, tx.Table("channel_info_json_test").First(&updated, channel.Id).Error)
			require.Equal(t, stored.ChannelInfo, updated.ChannelInfo)
		})
	}
}

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
