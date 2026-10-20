package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
)

func TestChatOptionValidationHappensBeforePersistence(t *testing.T) {
	isolatePricingConfig(t)
	previous := setting.Chats2JsonString()
	t.Cleanup(func() { require.NoError(t, setting.UpdateChatsByJsonString(previous)) })
	const value = `[{"Local":"https://example.com/chat?key={key}"}]`
	require.NoError(t, UpdateOption("Chats", value))
	require.Error(t, UpdateOption("Chats", `[{"unsafe":"javascript:alert(1)"}]`))
	var stored Option
	require.NoError(t, DB.First(&stored, "key = ?", "Chats").Error)
	require.Equal(t, value, stored.Value)
	require.JSONEq(t, value, setting.Chats2JsonString())
}
