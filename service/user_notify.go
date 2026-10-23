package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func receivesChannelNotifications(role int, settings dto.UserSetting) bool {
	if role < common.RoleAdminUser {
		return false
	}
	if settings.ChannelNotifyEnabled != nil {
		return *settings.ChannelNotifyEnabled
	}
	return role == common.RoleRootUser
}

func NotifyChannelWatchers(notifyType string, render func(lang string) (string, string)) {
	notifyAdmins(notifyType, receivesChannelNotifications, render)
}

func NotifyUpstreamModelUpdateWatchers(subject string, content string) {
	sentCount := notifyAdmins(dto.NotifyTypeChannelUpdate, func(_ int, settings dto.UserSetting) bool {
		return settings.UpstreamModelUpdateNotifyEnabled
	}, func(_ string) (string, string) { return subject, content })
	common.SysLog(fmt.Sprintf("upstream model update notifications sent: %d", sentCount))
}

func notifyAdmins(notifyType string, receives func(int, dto.UserSetting) bool, render func(string) (string, string)) int {
	var users []model.User
	if err := model.DB.
		Select("id", "role", "status", "setting").
		Where("status = ? AND role >= ?", common.UserStatusEnabled, common.RoleAdminUser).
		Find(&users).Error; err != nil {
		common.SysLog(fmt.Sprintf("failed to query upstream update notification users: %s", err.Error()))
		return 0
	}

	sentCount := 0
	for _, user := range users {
		userSetting := user.GetSetting()
		if !receives(user.Role, userSetting) {
			continue
		}
		subject, content := render(userSetting.Language)
		if err := NotifyUser(user.Id, userSetting, dto.NewNotify(notifyType, subject, content, nil)); err != nil {
			common.SysLog(fmt.Sprintf("failed to notify user %d for upstream model update: %s", user.Id, err.Error()))
			continue
		}
		sentCount++
	}
	return sentCount
}

func NotifyUser(userId int, userSetting dto.UserSetting, data dto.Notify) error {
	if data.Type == dto.NotifyTypeQuotaExceed && (!common.QuotaRemindEnabled || userSetting.QuotaWarningEnabled != nil && !*userSetting.QuotaWarningEnabled) {
		return nil
	}
	notifyType := userSetting.NotifyType
	if notifyType == "" {
		notifyType = dto.NotifyTypeEmail
	}
	if notifyType == dto.NotifyTypeEmail && (!userSetting.NotificationEmailVerified || userSetting.NotificationEmail == "") {
		return model.ErrNotificationEmailUnverified
	}

	// Check notification limit
	canSend, err := CheckNotificationLimit(userId, data.Type)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to check notification limit: %s", err.Error()))
		return err
	}
	if !canSend {
		return fmt.Errorf("notification limit exceeded for user %d with type %s", userId, notifyType)
	}

	switch notifyType {
	case dto.NotifyTypeEmail:
		return sendEmailNotify(userSetting.NotificationEmail, data)
	case dto.NotifyTypeWebhook:
		webhookURLStr := userSetting.WebhookUrl
		if webhookURLStr == "" {
			common.SysLog(fmt.Sprintf("user %d has no webhook url, skip sending webhook", userId))
			return nil
		}

		// 获取 webhook secret
		webhookSecret := userSetting.WebhookSecret
		return SendWebhookNotify(webhookURLStr, webhookSecret, data)
	case dto.NotifyTypeBark:
		barkURL := userSetting.BarkUrl
		if barkURL == "" {
			common.SysLog(fmt.Sprintf("user %d has no bark url, skip sending bark", userId))
			return nil
		}
		return sendBarkNotify(barkURL, data)
	case dto.NotifyTypeGotify:
		gotifyUrl := userSetting.GotifyUrl
		gotifyToken := userSetting.GotifyToken
		if gotifyUrl == "" || gotifyToken == "" {
			common.SysLog(fmt.Sprintf("user %d has no gotify url or token, skip sending gotify", userId))
			return nil
		}
		return sendGotifyNotify(gotifyUrl, gotifyToken, userSetting.GotifyPriority, data)
	}
	return nil
}

func sendEmailNotify(userEmail string, data dto.Notify) error {
	// make email content
	content := data.Content
	// 处理占位符
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}
	// Wrap in standard email template shell
	content = common.WrapEmailShell(data.Title, content)
	return common.SendEmail(data.Title, userEmail, content)
}

func sendBarkNotify(barkURL string, data dto.Notify) error {
	// 处理占位符
	content := data.Content
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}

	// 替换模板变量
	finalURL := strings.ReplaceAll(barkURL, "{{title}}", url.QueryEscape(data.Title))
	finalURL = strings.ReplaceAll(finalURL, "{{content}}", url.QueryEscape(content))

	// 发送GET请求到Bark
	var req *http.Request
	var resp *http.Response
	var err error

	// SSRF防护：验证Bark URL
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(finalURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("request reject: %v", err)
	}

	// 直接发送请求
	req, err = http.NewRequest(http.MethodGet, finalURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create bark request: %v", err)
	}

	// 设置User-Agent
	req.Header.Set("User-Agent", "HyxAPI-Notify/1.0")

	// 发送请求
	client := GetHttpClient()
	resp, err = client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send bark request: %v", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("bark request failed with status code: %d", resp.StatusCode)
	}

	return nil
}

func sendGotifyNotify(gotifyUrl string, gotifyToken string, priority int, data dto.Notify) error {
	// 处理占位符
	content := data.Content
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}

	// 构建完整的 Gotify API URL
	// 确保 URL 以 /message 结尾
	finalURL := strings.TrimSuffix(gotifyUrl, "/") + "/message?token=" + url.QueryEscape(gotifyToken)

	// Gotify优先级范围0-10，如果超出范围则使用默认值5
	if priority < 0 || priority > 10 {
		priority = 5
	}

	// 构建 JSON payload
	type GotifyMessage struct {
		Title    string `json:"title"`
		Message  string `json:"message"`
		Priority int    `json:"priority"`
	}

	payload := GotifyMessage{
		Title:    data.Title,
		Message:  content,
		Priority: priority,
	}

	// 序列化为 JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal gotify payload: %v", err)
	}

	var req *http.Request
	var resp *http.Response

	// SSRF防护：验证Gotify URL
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(finalURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("request reject: %v", err)
	}

	// 直接发送请求
	req, err = http.NewRequest(http.MethodPost, finalURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create gotify request: %v", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("User-Agent", "HyxAPI-Notify/1.0")

	// 发送请求
	client := GetHttpClient()
	resp, err = client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send gotify request: %v", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("gotify request failed with status code: %d", resp.StatusCode)
	}

	return nil
}
