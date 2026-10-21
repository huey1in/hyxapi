package controller

import (
	"encoding/json"
	"errors"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// Apply only notification fields; older clients must not reset unrelated
// preferences or switches they do not know about.
func applyNotificationSettings(current dto.UserSetting, value any, role int) (dto.UserSetting, error) {
	if _, ok := value.(map[string]interface{}); !ok {
		return current, errors.New("notification settings must be an object")
	}
	var patch struct {
		NotifyType     *string  `json:"notify_type"`
		Threshold      *float64 `json:"quota_warning_threshold"`
		QuotaEnabled   *bool    `json:"quota_warning_enabled"`
		ChannelEnabled *bool    `json:"channel_notify_enabled"`
		ModelEnabled   *bool    `json:"upstream_model_update_notify_enabled"`
		Email          *string  `json:"notification_email"`
		WebhookURL     *string  `json:"webhook_url"`
		WebhookSecret  *string  `json:"webhook_secret"`
		BarkURL        *string  `json:"bark_url"`
		GotifyURL      *string  `json:"gotify_url"`
		GotifyToken    *string  `json:"gotify_token"`
		GotifyPriority *int     `json:"gotify_priority"`
		AcceptUnset    *bool    `json:"accept_unset_model_ratio_model"`
		RecordIP       *bool    `json:"record_ip_log"`
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return current, err
	}
	if err = json.Unmarshal(encoded, &patch); err != nil {
		return current, err
	}
	if patch.NotifyType != nil {
		switch *patch.NotifyType {
		case "", dto.NotifyTypeEmail, dto.NotifyTypeWebhook, dto.NotifyTypeBark, dto.NotifyTypeGotify:
			current.NotifyType = *patch.NotifyType
		default:
			return current, errors.New("unsupported notification method")
		}
	}
	if patch.Threshold != nil {
		if *patch.Threshold < 0 {
			return current, errors.New("reminder threshold cannot be negative")
		}
		current.QuotaWarningThreshold = *patch.Threshold
	}
	if patch.QuotaEnabled != nil {
		current.QuotaWarningEnabled = patch.QuotaEnabled
	}
	if patch.AcceptUnset != nil {
		current.AcceptUnsetRatioModel = *patch.AcceptUnset
	}
	if patch.RecordIP != nil {
		current.RecordIpLog = *patch.RecordIP
	}
	if role >= common.RoleAdminUser {
		if patch.ChannelEnabled != nil {
			current.ChannelNotifyEnabled = patch.ChannelEnabled
		}
		if patch.ModelEnabled != nil {
			current.UpstreamModelUpdateNotifyEnabled = *patch.ModelEnabled
		}
	}
	if patch.Email != nil {
		if *patch.Email != "" && (*patch.Email != current.NotificationEmail || !current.NotificationEmailVerified) {
			return current, model.ErrNotificationEmailUnverified
		}
		if *patch.Email == "" {
			current.NotificationEmailVerified = false
		}
	}
	for _, address := range []*string{patch.WebhookURL, patch.BarkURL, patch.GotifyURL} {
		if address == nil || *address == "" {
			continue
		}
		parsed, err := url.Parse(*address)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			return current, errors.New("notification URL must use http or https")
		}
	}
	for _, field := range []struct {
		target *string
		value  *string
	}{
		{&current.NotificationEmail, patch.Email}, {&current.WebhookUrl, patch.WebhookURL},
		{&current.WebhookSecret, patch.WebhookSecret}, {&current.BarkUrl, patch.BarkURL},
		{&current.GotifyUrl, patch.GotifyURL}, {&current.GotifyToken, patch.GotifyToken},
	} {
		if field.value != nil {
			*field.target = *field.value
		}
	}
	if patch.GotifyPriority != nil {
		if *patch.GotifyPriority < 0 || *patch.GotifyPriority > 10 {
			return current, errors.New("Gotify priority must be between 0 and 10")
		}
		current.GotifyPriority = *patch.GotifyPriority
	}
	if current.NotifyType == "" {
		current.NotifyType = dto.NotifyTypeEmail
	}
	var target string
	switch current.NotifyType {
	case dto.NotifyTypeWebhook:
		target = current.WebhookUrl
	case dto.NotifyTypeBark:
		target = current.BarkUrl
	case dto.NotifyTypeGotify:
		target = current.GotifyUrl
		if current.GotifyToken == "" {
			return current, errors.New("Gotify token cannot be empty")
		}
	}
	if current.NotifyType != dto.NotifyTypeEmail {
		parsed, err := url.Parse(target)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			return current, errors.New("notification URL must use http or https")
		}
	}
	return current, nil
}
