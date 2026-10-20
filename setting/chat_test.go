package setting

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChatPresetsRejectInvalidUpdatesWithoutLosingSavedConfiguration(t *testing.T) {
	previous := Chats2JsonString()
	t.Cleanup(func() { require.NoError(t, UpdateChatsByJsonString(previous)) })
	const saved = `[{"客户端":"https://chat.example/?key={key}&url={address}"},{"CC Switch":"ccswitch"}]`
	require.NoError(t, UpdateChatsByJsonString(saved))
	for _, invalid := range []string{
		`null`, `{}`, `[{"one":"https://example.com","two":"https://example.org"}]`,
		`[{"":"https://example.com"}]`, `[{"client":17}]`, `[{"client":"/relative"}]`,
		`[{"client":"javascript:alert(1)"}]`, `[{"client":"DATA:text/html,test"}]`,
		`[{"client":"https://user:password@example.com"}]`, `[{"client":"https://"}]`,
	} {
		require.Error(t, UpdateChatsByJsonString(invalid), invalid)
		require.JSONEq(t, saved, Chats2JsonString())
	}
	copy := GetChats()
	copy[0]["客户端"] = "changed"
	require.JSONEq(t, saved, Chats2JsonString(), "status consumers must not mutate global presets")
	require.NoError(t, UpdateChatsByJsonString(`[]`))
	require.Equal(t, "[]", Chats2JsonString())
}

func TestChatPresetReadersObserveCompleteSnapshots(t *testing.T) {
	previous := Chats2JsonString()
	t.Cleanup(func() { require.NoError(t, UpdateChatsByJsonString(previous)) })
	var workers sync.WaitGroup
	for range 4 {
		workers.Go(func() {
			for range 25 {
				if err := UpdateChatsByJsonString(`[{"client":"deepchat://install?data={deepchatConfig}"}]`); err != nil {
					t.Error(err)
				}
				if err := ValidateChatsJSON(Chats2JsonString()); err != nil {
					t.Error(err)
				}
			}
		})
	}
	workers.Wait()
}
