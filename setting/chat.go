package setting

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"sync"
)

var chatsLock sync.RWMutex
var chats = []map[string]string{
	//{
	//	"ChatGPT Next Web 官方示例": "https://app.nextchat.dev/#/?settings={\"key\":\"{key}\",\"url\":\"{address}\"}",
	//},
	{
		"Cherry Studio": "cherrystudio://providers/api-keys?v=1&data={cherryConfig}",
	},
	{
		"AionUI": "aionui://provider/add?v=1&data={aionuiConfig}",
	},
	{
		"流畅阅读": "fluentread",
	},
	{
		"CC Switch": "ccswitch",
	},
	{
		"DeepChat": "deepchat://provider/install?v=1&data={deepchatConfig}",
	},
	{
		"AQBot": "aqbot://providers?{aqbotConfig}",
	},
	{
		"Lobe Chat 官方示例": "https://chat-preview.lobehub.com/?settings={\"keyVaults\":{\"openai\":{\"apiKey\":\"{key}\",\"baseURL\":\"{address}/v1\"}}}",
	},
	{
		"AI as Workspace": "https://aiaw.app/set-provider?provider={\"type\":\"openai\",\"settings\":{\"apiKey\":\"{key}\",\"baseURL\":\"{address}/v1\",\"compatibility\":\"strict\"}}",
	},
	{
		"AMA 问天": "ama://set-api-key?server={address}&key={key}",
	},
	{
		"OpenCat": "opencat://team/join?domain={address}&token={key}",
	},
}

func parseChats(value string) ([]map[string]string, error) {
	var parsed []map[string]string
	if len(value) > 65536 || json.Unmarshal([]byte(value), &parsed) != nil || parsed == nil || len(parsed) > 100 {
		return nil, errors.New("Chats must be a JSON array containing at most 100 client presets")
	}
	for _, entry := range parsed {
		if len(entry) != 1 {
			return nil, errors.New("Each chat preset must contain one client name and URL")
		}
		for name, target := range entry {
			if strings.TrimSpace(name) == "" || strings.TrimSpace(target) != target || target == "" {
				return nil, errors.New("Chat client names and URLs must not be empty")
			}
			if target == "fluentread" || target == "ccswitch" {
				continue
			}
			u, err := url.Parse(target)
			if err != nil || u.Scheme == "" || strings.ContainsAny(target, "\r\n\t") {
				return nil, errors.New("Invalid chat client URL")
			}
			switch strings.ToLower(u.Scheme) {
			case "http", "https":
				if u.Hostname() == "" || u.User != nil {
					return nil, errors.New("Web chat URLs require a hostname without credentials")
				}
			case "javascript", "data", "vbscript", "file", "blob", "about":
				return nil, errors.New("Unsupported chat client URL scheme")
			}
		}
	}
	return parsed, nil
}

func ValidateChatsJSON(value string) error {
	_, err := parseChats(value)
	return err
}

func UpdateChatsByJsonString(value string) error {
	parsed, err := parseChats(value)
	if err != nil {
		return err
	}
	chatsLock.Lock()
	chats = parsed
	chatsLock.Unlock()
	return nil
}

func GetChats() []map[string]string {
	chatsLock.RLock()
	defer chatsLock.RUnlock()
	result := make([]map[string]string, len(chats))
	for i, entry := range chats {
		result[i] = make(map[string]string, len(entry))
		for name, target := range entry {
			result[i][name] = target
		}
	}
	return result
}

func Chats2JsonString() string {
	encoded, _ := json.Marshal(GetChats())
	return string(encoded)
}
