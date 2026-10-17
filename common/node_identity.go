package common

import "os"

func initNodeNameIdentity() {
	if envNodeName := os.Getenv("NODE_NAME"); envNodeName != "" {
		NodeName = envNodeName
		return
	}

	hostname, _ := os.Hostname()
	NodeName = hostname
}
