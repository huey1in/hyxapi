package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/setting"
)

// 多 Key 合一模式下的单 Key 临时冷却状态（纯内存，重启清零）。
// 当某个 key 在统计窗口内失败次数达到阈值时，进入冷却期，期间选 key 时跳过它，到期自动恢复。

type keyCooldownState struct {
	failures    []int64 // 窗口内失败时间戳（秒）
	cooledUntil int64   // 冷却截止时间戳（秒），0 表示未冷却
}

var (
	keyCooldownStore sync.Map // "channelId:keyIndex" -> *keyCooldownState
	keyCooldownMu    sync.Mutex
)

func keyCooldownKey(channelId, keyIndex int) string {
	return fmt.Sprintf("%d:%d", channelId, keyIndex)
}

// RecordKeyFailure 记录一次 key 失败；窗口内累计达到阈值则进入冷却。
func RecordKeyFailure(channelId, keyIndex int) {
	if !setting.MultiKeyCooldownEnabled {
		return
	}
	threshold := setting.MultiKeyCooldownThreshold
	if threshold <= 0 {
		return
	}
	windowSec := int64(setting.MultiKeyCooldownWindowMinutes) * 60
	if windowSec <= 0 {
		windowSec = 60
	}
	durationSec := int64(setting.MultiKeyCooldownDurationMinutes) * 60
	if durationSec <= 0 {
		durationSec = 300
	}
	now := time.Now().Unix()

	keyCooldownMu.Lock()
	defer keyCooldownMu.Unlock()

	k := keyCooldownKey(channelId, keyIndex)
	var st *keyCooldownState
	if v, ok := keyCooldownStore.Load(k); ok {
		st = v.(*keyCooldownState)
	} else {
		st = &keyCooldownState{}
		keyCooldownStore.Store(k, st)
	}

	// 裁掉窗口外的失败记录，追加本次
	cutoff := now - windowSec
	kept := st.failures[:0]
	for _, ts := range st.failures {
		if ts >= cutoff {
			kept = append(kept, ts)
		}
	}
	kept = append(kept, now)
	st.failures = kept

	if len(st.failures) >= threshold {
		st.cooledUntil = now + durationSec
		st.failures = nil
	}
}

// RecordKeySuccess 记录一次 key 成功，清空其失败窗口（计数不跨成功累积）。
func RecordKeySuccess(channelId, keyIndex int) {
	if !setting.MultiKeyCooldownEnabled {
		return
	}
	k := keyCooldownKey(channelId, keyIndex)
	v, ok := keyCooldownStore.Load(k)
	if !ok {
		return
	}
	keyCooldownMu.Lock()
	defer keyCooldownMu.Unlock()
	st := v.(*keyCooldownState)
	st.failures = nil
}

// IsKeyInCooldown 判断某个 key 当前是否处于冷却期。
func IsKeyInCooldown(channelId, keyIndex int) bool {
	if !setting.MultiKeyCooldownEnabled {
		return false
	}
	v, ok := keyCooldownStore.Load(keyCooldownKey(channelId, keyIndex))
	if !ok {
		return false
	}
	st := v.(*keyCooldownState)
	return time.Now().Unix() < st.cooledUntil
}
