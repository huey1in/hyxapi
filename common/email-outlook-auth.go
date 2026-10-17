package common

import (
	"strings"
)

func isOutlookServer(server string) bool {
	// 兼容多地区的outlook邮箱和ofb邮箱
	// 其实应该加一个Option来区分是否用LOGIN的方式登录
	// 先临时兼容一下
	return strings.Contains(server, "outlook") || strings.Contains(server, "onmicrosoft")
}
