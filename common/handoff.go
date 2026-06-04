package common

import (
	"sync"
	"time"
)

type handoffValue struct {
	userId int
	expiry time.Time
}

const handoffTTL = 120 * time.Second

var handoffMutex sync.Mutex
var handoffMap = make(map[string]handoffValue)

// IssueHandoff 为指定用户生成一个一次性、短期有效的跨域登录交换码。
func IssueHandoff(userId int) string {
	code := GetUUID()
	handoffMutex.Lock()
	defer handoffMutex.Unlock()
	handoffMap[code] = handoffValue{
		userId: userId,
		expiry: time.Now().Add(handoffTTL),
	}
	cleanupExpiredHandoffs()
	return code
}

// ConsumeHandoff 校验并销毁一个交换码，返回对应用户 id。单次有效。
func ConsumeHandoff(code string) (int, bool) {
	if code == "" {
		return 0, false
	}
	handoffMutex.Lock()
	defer handoffMutex.Unlock()
	v, ok := handoffMap[code]
	if !ok {
		return 0, false
	}
	delete(handoffMap, code)
	if time.Now().After(v.expiry) {
		return 0, false
	}
	return v.userId, true
}

// cleanupExpiredHandoffs 惰性清理过期项；调用方必须已持有 handoffMutex。
func cleanupExpiredHandoffs() {
	now := time.Now()
	for k, v := range handoffMap {
		if now.After(v.expiry) {
			delete(handoffMap, k)
		}
	}
}
