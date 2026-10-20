package service

import (
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestExtractChannelAffinityValue_RequestHeader(t *testing.T) {
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Request.Header.Set("X-Affinity-Key", " tenant-123 ")

	value := extractChannelAffinityValue(ctx, operation_setting.ChannelAffinityKeySource{
		Type: "request_header",
		Key:  "X-Affinity-Key",
	})

	require.Equal(t, "tenant-123", value)
}

func TestGetPreferredChannelByAffinity_RequestHeaderKeySource(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rule := operation_setting.ChannelAffinityRule{
		Name:       "header-affinity",
		ModelRegex: []string{"^gpt-.*$"},
		PathRegex:  []string{"/v1/responses"},
		KeySources: []operation_setting.ChannelAffinityKeySource{
			{Type: "request_header", Key: "X-Affinity-Key"},
		},
		IncludeRuleName:  true,
		IncludeModelName: true,
	}

	affinityValue := fmt.Sprintf("header-hit-%d", time.Now().UnixNano())
	cacheKeySuffix := buildChannelAffinityCacheKeySuffix(rule, "gpt-5", "default", affinityValue)

	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 9528, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})

	setting := operation_setting.GetChannelAffinitySetting()
	originalRules := setting.Rules
	setting.Rules = append([]operation_setting.ChannelAffinityRule{rule}, originalRules...)
	t.Cleanup(func() {
		setting.Rules = originalRules
	})

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Request.Header.Set("X-Affinity-Key", affinityValue)

	channelID, found := GetPreferredChannelByAffinity(ctx, "gpt-5", "default")
	require.True(t, found)
	require.Equal(t, 9528, channelID)

	meta, ok := getChannelAffinityMeta(ctx)
	require.True(t, ok)
	require.Equal(t, "request_header", meta.KeySourceType)
	require.Equal(t, "X-Affinity-Key", meta.KeySourceKey)
	require.Equal(t, buildChannelAffinityKeyHint(affinityValue), meta.KeyHint)
}

func TestClearCurrentChannelAffinityCache(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cacheKeySuffix := fmt.Sprintf("codex cli trace:default:clear-current-%d", time.Now().UnixNano())
	cacheKeyFull := channelAffinityCacheNamespace + ":" + cacheKeySuffix
	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 9527, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})

	ctx := buildChannelAffinityTemplateContextForTest(channelAffinityMeta{
		CacheKey:   cacheKeyFull,
		TTLSeconds: 60,
		RuleName:   "codex cli trace",
		SkipRetry:  true,
	})
	require.True(t, ShouldSkipRetryAfterChannelAffinityFailure(ctx))

	deleted := ClearCurrentChannelAffinityCache(ctx)
	require.True(t, deleted)
	_, found, err := cache.Get(cacheKeySuffix)
	require.NoError(t, err)
	require.False(t, found)
	require.False(t, ShouldSkipRetryAfterChannelAffinityFailure(ctx))
}

func TestSessionRulesInheritOrOverrideGlobalDefault(t *testing.T) {
	setting := operation_setting.GetChannelAffinitySetting()
	previous := *setting
	t.Cleanup(func() { *setting = previous })
	for _, globalMode := range []string{"", "off", "prefer", "strict"} {
		for _, tc := range []struct {
			name, mode, expected string
			skipRetry            bool
		}{
			{name: "inherit", mode: "inherit", expected: globalMode},
			{name: "override-strict", mode: "strict", expected: "strict"},
			{name: "override-prefer", mode: "prefer", expected: "prefer", skipRetry: true},
			{name: "override-off", mode: "off", expected: "off", skipRetry: true},
			{name: "legacy-strict", expected: "strict", skipRetry: true},
			{name: "legacy-prefer", expected: "prefer"},
		} {
			t.Run(globalMode+"/"+tc.name, func(t *testing.T) {
				expected := tc.expected
				if expected == "" {
					expected = "prefer"
				}
				source := "session_rule"
				if tc.mode == "inherit" {
					source = "global"
				}
				rule := operation_setting.ChannelAffinityRule{
					Name: tc.name, ModelRegex: []string{"^test-model$"},
					KeySources:  []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}},
					SessionMode: tc.mode, SkipRetryOnFailure: tc.skipRetry,
					ParamOverrideTemplate: map[string]any{"temperature": 0}, IncludeRuleName: true,
				}
				encoded, err := common.Marshal([]operation_setting.ChannelAffinityRule{rule})
				require.NoError(t, err)
				snapshot, err := model.BuildRequestPolicy(map[string]string{"RetryTimes": "2", "channel_affinity_setting.enabled": "true", "channel_affinity_setting.session_mode": globalMode, "channel_affinity_setting.rules": string(encoded)})
				require.NoError(t, err)
				*setting = snapshot.Affinity
				key := t.Name()
				cacheKey := buildChannelAffinityCacheKeySuffix(rule, "test-model", "default", key)
				cache := getChannelAffinityCache()
				require.NoError(t, cache.SetWithTTL(cacheKey, 1, time.Minute))
				t.Cleanup(func() { _, err := cache.DeleteMany([]string{cacheKey}); assert.NoError(t, err) })
				ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
				ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
				ctx.Request.Header.Set("X-Session", key)
				state := RequestPolicy(ctx)
				channelID, found := GetPreferredChannelByAffinity(ctx, "test-model", "default")
				assert.Equal(t, expected != "off", found)
				if found {
					assert.Equal(t, 1, channelID)
				}
				assert.Equal(t, expected, state.SessionMode)
				assert.Equal(t, source, state.SessionModeSource)
				assert.Equal(t, expected == "strict", ShouldSkipRetryAfterChannelAffinityFailure(ctx))
				decision := DecideRelayRetry(ctx, types.NewOpenAIError(errors.New("upstream"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests), 2)
				if expected == "strict" {
					assert.Equal(t, PolicyDecision{Action: "stop", Reason: "strict_session", Source: source}, decision)
				} else {
					assert.Equal(t, "retry", decision.Action)
				}
				events := state.Events()
				require.Len(t, events, 1)
				assert.Equal(t, PolicyDecision{Action: "match", Reason: "session_rule_matched", Source: "session_rule"}, events[0].Decision)
				assert.Equal(t, tc.name, events[0].Rule)
				transformed, applied := ApplyChannelAffinityOverrideTemplate(ctx, nil)
				assert.True(t, applied, "session behavior does not disable request transforms")
				assert.EqualValues(t, 0, transformed["temperature"])
				if expected == "off" {
					ctx.Set("channel_id", 9)
					RecordChannelAffinity(ctx, 9)
					cached, found, err := cache.Get(cacheKey)
					require.NoError(t, err)
					assert.True(t, found)
					assert.Equal(t, 1, cached, "off does not refresh session bindings")
					_, err = cache.DeleteMany([]string{cacheKey})
					require.NoError(t, err)
					RecordChannelAffinity(ctx, 9)
					_, found, err = cache.Get(cacheKey)
					require.NoError(t, err)
					assert.False(t, found, "off does not establish session bindings")
				}
			})
		}
	}
}
