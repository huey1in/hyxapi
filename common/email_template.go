package common

import (
	"fmt"
	"strings"
	"time"
)

// Default email templates with {{variable}} placeholders

const emailHead = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#fffdf7;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffdf7;">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;text-align:left;">`

const emailFoot = `<tr><td style="padding-top:32px;border-top:1px solid #e5e5e5;">
  <p style="margin:0;font-size:12px;line-height:1.5;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{{siteName}}</p>
</td></tr>
</table></td></tr></table></body></html>`

const DefaultEmailVerificationTemplate = emailHead + `
<tr><td style="padding-bottom:32px;">
  <p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{{siteName}}</p>
</td></tr>
<tr><td>
  <h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">验证您的邮箱</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#525252;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">请输入以下验证码完成邮箱验证，验证码将在 {{expireMinutes}} 分钟后失效。</p>
</td></tr>
<tr><td style="padding-bottom:28px;">
  <code style="font-size:30px;font-weight:600;letter-spacing:4px;color:#1a1a1a;font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">{{code}}</code>
</td></tr>
<tr><td>
  <p style="margin:0;font-size:13px;line-height:1.6;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">如果这不是您本人的操作，请忽略此邮件。</p>
</td></tr>
` + emailFoot

const DefaultPasswordResetTemplate = emailHead + `
<tr><td style="padding-bottom:32px;">
  <p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{{siteName}}</p>
</td></tr>
<tr><td>
  <h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">重置您的密码</h1>
  <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#525252;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">我们收到了您的密码重置请求。如果是您本人操作，请点击下方按钮。链接将在 {{expireMinutes}} 分钟后失效。</p>
</td></tr>
<tr><td style="padding-bottom:28px;">
  <a href="{{resetLink}}" style="display:inline-block;padding:11px 24px;background-color:#1a1a1a;color:#ffffff;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">重置密码</a>
</td></tr>
<tr><td>
  <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#525252;word-break:break-all;font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">{{resetLink}}</p>
  <p style="margin:0;font-size:13px;line-height:1.6;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">如果这不是您本人的操作，请忽略此邮件。</p>
</td></tr>
` + emailFoot

const DefaultTestEmailTemplate = emailHead + `
<tr><td style="padding-bottom:32px;">
  <p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{{siteName}}</p>
</td></tr>
<tr><td>
  <h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">测试邮件</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;color:#525252;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">SMTP 邮件服务配置正常，此邮件仅用于验证发信功能。</p>
  <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#ababab;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">{{time}}</p>
</td></tr>
` + emailFoot

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

// RenderTestEmail renders the test email template
func RenderTestEmail() (string, string) {
	subject := fmt.Sprintf("%s 测试邮件", SystemName)
	content := RenderTemplate(DefaultTestEmailTemplate, map[string]string{
		"siteName": SystemName,
		"time":     time.Now().Format("2006-01-02 15:04:05"),
	})
	return subject, content
}
