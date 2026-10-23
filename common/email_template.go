package common

import (
	_ "embed"
	"fmt"
	"html"
	"strconv"
	"strings"
	"time"
)

// Built-in templates use the site's current custom email layout. Verification
// copy remains contextual for registration, account binding and notifications.

//go:embed email_templates/verification.html
var DefaultEmailVerificationTemplate string

//go:embed email_templates/password_reset.html
var DefaultPasswordResetTemplate string

//go:embed email_templates/notification.html
var defaultNotificationEmailTemplate string

var DefaultTestEmailTemplate = strings.NewReplacer(
	"{{title}}", "测试邮件",
	"{{bodyHTML}}", `<p style="margin: 0;">SMTP 邮件服务配置正常，此邮件仅用于验证发信功能。</p>
<p style="margin: 20px 0 0; color: #767676; font-size: 13px; line-height: 24px;">{{time}}</p>`,
).Replace(defaultNotificationEmailTemplate)

// Email template option keys
const (
	EmailTemplateVerificationKey  = "EmailTemplateVerification"
	EmailTemplatePasswordResetKey = "EmailTemplatePasswordReset"
)

// defaultTemplates maps option keys to their default HTML templates
var defaultTemplates = map[string]string{
	EmailTemplateVerificationKey:  DefaultEmailVerificationTemplate,
	EmailTemplatePasswordResetKey: DefaultPasswordResetTemplate,
}

// RenderTemplate replaces {{key}} placeholders with corresponding values
func RenderTemplate(tmpl string, vars map[string]string) string {
	result := tmpl
	for k, v := range vars {
		result = strings.ReplaceAll(result, fmt.Sprintf("{{%s}}", k), v)
	}
	return result
}

// GetEmailTemplate returns the custom template from OptionMap if set,
// otherwise falls back to the default template.
func GetEmailTemplate(key string) string {
	if val, ok := OptionMap[key]; ok && strings.TrimSpace(val) != "" {
		return val
	}
	if def, ok := defaultTemplates[key]; ok {
		return def
	}
	return ""
}

type VerificationEmail struct {
	Code          string
	ExpireMinutes int
	Title         string
	Description   string
	Notice        string
}

// RenderVerificationEmail shares the configured verification template across
// registration, account binding and notification-mailbox verification.
func RenderVerificationEmail(mail VerificationEmail) string {
	if mail.Title == "" {
		mail.Title = "验证您的邮箱"
	}
	if mail.Description == "" {
		mail.Description = fmt.Sprintf("请输入以下验证码完成邮箱验证，验证码将在 %d 分钟后失效。", mail.ExpireMinutes)
	}
	if mail.Notice == "" {
		mail.Notice = "如果这不是您本人的操作，请勿将验证码告诉任何人。"
	}
	commonVars := map[string]string{
		"siteName": SystemName, "code": mail.Code, "expireMinutes": strconv.Itoa(mail.ExpireMinutes),
		"title": mail.Title, "description": mail.Description, "notice": mail.Notice,
	}
	for key, value := range commonVars {
		commonVars[key] = html.EscapeString(value)
	}
	OptionMapRWMutex.RLock()
	tmpl := GetEmailTemplate(EmailTemplateVerificationKey)
	OptionMapRWMutex.RUnlock()
	return RenderTemplate(tmpl, commonVars)
}

// RenderTestEmail renders the test email template
func RenderTestEmail() (string, string) {
	subject := fmt.Sprintf("%s 测试邮件", SystemName)
	content := RenderTemplate(DefaultTestEmailTemplate, map[string]string{
		"siteName": html.EscapeString(SystemName),
		"time":     time.Now().Format("2006-01-02 15:04:05"),
	})
	return subject, content
}

// WrapEmailShell wraps a title + body HTML snippet into the standard email
// template shell. Used by notification emails (quota remind, channel alerts, etc.)
// so every outbound email shares the same visual style.
func WrapEmailShell(title string, bodyHTML string) string {
	// Replace once so HTML supplied by callers is preserved without treating
	// any template-looking text inside it as another template variable.
	return strings.NewReplacer(
		"{{siteName}}", html.EscapeString(SystemName),
		"{{title}}", html.EscapeString(title),
		"{{bodyHTML}}", bodyHTML,
	).Replace(defaultNotificationEmailTemplate)
}
