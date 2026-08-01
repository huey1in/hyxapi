//go:build !windows

package controller

func getWindowsSystemProxy() string {
	return ""
}
