package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestUpstreamSelectionRollsBackModelsSettingsAndAbilitiesTogether(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	channel := &model.Channel{Type: 1, Name: "atomic preview", Models: "keep,remove", Group: "default", Status: 1}
	settings := channel.GetOtherSettings()
	settings.UpstreamModelUpdateLastDetectedModels = []string{"add", "later"}
	settings.UpstreamModelUpdateLastRemovedModels = []string{"remove"}
	channel.SetOtherSettings(settings)
	require.NoError(t, channel.Insert())
	// Exercise the same projection used by scheduled scans and bulk apply.
	batch, err := findEnabledChannelsAfterID(0, 100)
	require.NoError(t, err)
	require.Len(t, batch, 1)
	require.Equal(t, model.ChannelModelStateRevision(channel), model.ChannelModelStateRevision(batch[0]))
	original := *channel
	require.NoError(t, db.Exec("CREATE TEMP TRIGGER upstream_fail_abilities BEFORE INSERT ON abilities BEGIN SELECT RAISE(ABORT, 'fixture routing failure'); END").Error)
	_, _, _, _, _, err = applyChannelUpstreamModelUpdates(context.Background(), channel, []string{"add"}, nil, []string{"remove"})
	require.ErrorContains(t, err, "fixture routing failure")
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.Equal(t, original.Models, stored.Models)
	require.Equal(t, original.OtherSettings, stored.OtherSettings)
	var count int64
	require.NoError(t, db.Table("abilities").Where("channel_id = ?", channel.Id).Count(&count).Error)
	require.EqualValues(t, 2, count)
	require.NoError(t, db.Exec("DROP TRIGGER upstream_fail_abilities").Error)
	added, removed, pending, pendingRemove, changed, err := applyChannelUpstreamModelUpdates(context.Background(), stored, []string{"add", "injected"}, nil, []string{"remove"})
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, []string{"add"}, added)
	require.Equal(t, []string{"remove"}, removed)
	require.Equal(t, []string{"later"}, pending)
	require.Empty(t, pendingRemove)
	require.Equal(t, "keep,add", stored.Models)
}

func TestUpstreamDetectionRejectsConcurrentConfigurationButPreservesCounters(t *testing.T) {
	for _, routingChange := range []bool{true, false} {
		t.Run(map[bool]string{true: "configuration conflict", false: "live counters"}[routingChange], func(t *testing.T) {
			db := setupModelListControllerTestDB(t)
			channel := &model.Channel{Type: 1, Key: "fixture", Name: "original", Models: "keep", Group: "default", Status: 1}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				updates := map[string]any{"name": "new name", "used_quota": 7654}
				if routingChange {
					updates["models"] = "keep,concurrent"
				}
				if err := db.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(updates).Error; err != nil {
					t.Error(err)
				}
				_, _ = w.Write([]byte(`{"data":[{"id":"keep"},{"id":"add"}]}`))
			}))
			defer server.Close()
			channel.BaseURL = &server.URL
			require.NoError(t, channel.Insert())
			settings := channel.GetOtherSettings()
			_, _, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, false)
			if routingChange {
				require.ErrorIs(t, err, model.ErrChannelModelStateChanged)
			} else {
				require.NoError(t, err)
			}
			stored, err := model.GetChannelById(channel.Id, true)
			require.NoError(t, err)
			require.Equal(t, "new name", stored.Name)
			require.EqualValues(t, 7654, stored.UsedQuota)
			if routingChange {
				require.Equal(t, "keep,concurrent", stored.Models)
				require.Empty(t, stored.GetOtherSettings().UpstreamModelUpdateLastDetectedModels)
			} else {
				require.Equal(t, []string{"add"}, stored.GetOtherSettings().UpstreamModelUpdateLastDetectedModels)
			}
		})
	}
}

func TestUpstreamDiscoveryCancelsBoundsAndRejectsMissingData(t *testing.T) {
	started := make(chan struct{})
	closed := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
		close(closed)
	}))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() {
		_, err := fetchChannelUpstreamModelIDsWithContext(ctx, &model.Channel{Type: 1, Key: "fixture", BaseURL: &server.URL})
		done <- err
	}()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("discovery did not start")
	}
	cancel()
	select {
	case err := <-done:
		require.Error(t, err)
	case <-time.After(3 * time.Second):
		t.Fatal("discovery did not cancel")
	}
	select {
	case <-closed:
	case <-time.After(3 * time.Second):
		t.Fatal("upstream connection stayed open")
	}
	server.Close()
	for _, body := range []string{`{"error":"not models"}`, strings.Repeat("x", (2<<20)+1)} {
		fixture := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(body)) }))
		_, err := fetchChannelUpstreamModelIDsWithValidation(context.Background(), &model.Channel{Type: 1, Key: "fixture", BaseURL: &fixture.URL}, true)
		require.Error(t, err)
		fixture.Close()
	}
	redirected := false
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { redirected = true }))
	defer destination.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, destination.URL, http.StatusTemporaryRedirect)
	}))
	defer origin.Close()
	_, err := fetchChannelUpstreamModelIDs(&model.Channel{Type: 1, Key: "fixture", BaseURL: &origin.URL})
	require.Error(t, err)
	require.False(t, redirected)
}

func TestNormalizeModelNames(t *testing.T) {
	result := normalizeModelNames([]string{
		" gpt-4o ",
		"",
		"gpt-4o",
		"gpt-4.1",
		"   ",
	})

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
}

func TestMergeModelNames(t *testing.T) {
	result := mergeModelNames(
		[]string{"gpt-4o", "gpt-4.1"},
		[]string{"gpt-4.1", " gpt-4.1-mini ", "gpt-4o"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"}, result)
}

func TestSubtractModelNames(t *testing.T) {
	result := subtractModelNames(
		[]string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"},
		[]string{"gpt-4.1", "not-exists"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1-mini"}, result)
}

func TestIntersectModelNames(t *testing.T) {
	result := intersectModelNames(
		[]string{"gpt-4o", "gpt-4.1", "gpt-4.1", "not-exists"},
		[]string{"gpt-4.1", "gpt-4o-mini", "gpt-4o"},
	)

	require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
}

func TestApplySelectedModelChanges(t *testing.T) {
	t.Run("add and remove together", func(t *testing.T) {
		result := applySelectedModelChanges(
			[]string{"gpt-4o", "gpt-4.1", "claude-3"},
			[]string{"gpt-4.1-mini"},
			[]string{"claude-3"},
		)

		require.Equal(t, []string{"gpt-4o", "gpt-4.1", "gpt-4.1-mini"}, result)
	})

	t.Run("add wins when conflict with remove", func(t *testing.T) {
		result := applySelectedModelChanges(
			[]string{"gpt-4o"},
			[]string{"gpt-4.1"},
			[]string{"gpt-4.1"},
		)

		require.Equal(t, []string{"gpt-4o", "gpt-4.1"}, result)
	})
}

func TestNormalizeChannelModelMapping(t *testing.T) {
	modelMapping := `{
		" alias-model ": " upstream-model ",
		"": "invalid",
		"invalid-target": ""
	}`
	channel := &model.Channel{
		ModelMapping: &modelMapping,
	}

	result := normalizeChannelModelMapping(channel)
	require.Equal(t, map[string]string{
		"alias-model": "upstream-model",
	}, result)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithModelMapping(t *testing.T) {
	pendingAddModels, pendingRemoveModels := collectPendingUpstreamModelChangesFromModels(
		[]string{"alias-model", "gpt-4o", "stale-model"},
		[]string{"gpt-4o", "gpt-4.1", "mapped-target"},
		[]string{"gpt-4.1"},
		map[string]string{
			"alias-model": "mapped-target",
		},
	)

	require.Equal(t, []string{}, pendingAddModels)
	require.Equal(t, []string{"stale-model"}, pendingRemoveModels)
}

func TestCollectPendingUpstreamModelChangesFromModels_WithIgnoredRegexPatterns(t *testing.T) {
	pendingAddModels, pendingRemoveModels := collectPendingUpstreamModelChangesFromModels(
		[]string{"gpt-4o"},
		[]string{"gpt-4o", "claude-3-5-sonnet", "sora-video", "gpt-4.1"},
		[]string{"regex:^sora-.*$", "gpt-4.1"},
		nil,
	)

	require.Equal(t, []string{"claude-3-5-sonnet"}, pendingAddModels)
	require.Equal(t, []string{}, pendingRemoveModels)
}

func TestBuildUpstreamModelUpdateTaskNotificationContent_OmitOverflowDetails(t *testing.T) {
	channelSummaries := make([]upstreamModelUpdateChannelSummary, 0, 12)
	for i := 0; i < 12; i++ {
		channelSummaries = append(channelSummaries, upstreamModelUpdateChannelSummary{
			ChannelName: "channel-" + string(rune('A'+i)),
			AddCount:    i + 1,
			RemoveCount: i,
		})
	}

	content := buildUpstreamModelUpdateTaskNotificationContent(
		24,
		12,
		56,
		21,
		9,
		[]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
		channelSummaries,
		[]string{
			"gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini", "gemini-2.5-pro", "claude-3.7-sonnet",
			"qwen-max", "deepseek-r1", "llama-3.3-70b", "mistral-large", "command-r-plus", "doubao-pro-32k",
			"hunyuan-large",
		},
		[]string{
			"gpt-3.5-turbo", "claude-2.1", "gemini-1.5-pro", "mixtral-8x7b", "qwen-plus", "glm-4",
			"yi-large", "moonshot-v1", "doubao-lite",
		},
	)

	require.Contains(t, content, "其余 4 个渠道已省略")
	require.Contains(t, content, "其余 1 个已省略")
	require.Contains(t, content, "失败渠道 ID（展示 10/12）")
	require.Contains(t, content, "其余 2 个已省略")
}

func TestShouldSendUpstreamModelUpdateNotification(t *testing.T) {
	channelUpstreamModelUpdateNotifyState.Lock()
	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = 0
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = 0
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = 0
	channelUpstreamModelUpdateNotifyState.Unlock()

	baseTime := int64(2000000)

	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime, 6, 0))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+3600, 6, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+3600, 7, 0))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+7200, 7, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+8000, 0, 3))
	require.False(t, shouldSendUpstreamModelUpdateNotification(baseTime+9000, 0, 3))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+10000, 0, 4))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+90000, 7, 0))
	require.True(t, shouldSendUpstreamModelUpdateNotification(baseTime+90001, 0, 0))
}
