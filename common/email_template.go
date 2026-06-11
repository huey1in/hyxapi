package common

import (
	"fmt"
	"strings"
	"time"
)

// Default email templates with {{variable}} placeholders

const EmailHead = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f3ed;-webkit-text-size-adjust:100%;">
<table role="presentation" bgcolor="#f5f3ed" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ed;">
<tr><td height="32" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr><td align="center">
<table role="presentation" bgcolor="#fffdf7" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#fffdf7;border-radius:5px;">`

const EmailFoot = `<tr><td height="20" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td bgcolor="#e6ebf1" height="1" style="font-size:1px;line-height:1px;">&nbsp;</td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td height="31" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td style="font-size:12px;line-height:16px;color:#707070;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">{{siteName}}</td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td height="64" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td height="64" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
</table></body></html>`

const emailFont = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`

const DefaultEmailVerificationTemplate = EmailHead + `
<tr><td colspan="3" height="40" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:` + emailFont + `;">{{siteName}}</p></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td>
    <h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:` + emailFont + `;">验证您的邮箱</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#525252;font-family:` + emailFont + `;">请输入以下验证码完成邮箱验证，验证码将在 {{expireMinutes}} 分钟后失效。</p>
  </td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><code style="font-size:30px;font-weight:600;letter-spacing:4px;color:#1a1a1a;font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">{{code}}</code></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><p style="margin:0;font-size:13px;line-height:1.6;color:#ababab;font-family:` + emailFont + `;">如果这不是您本人的操作，请忽略此邮件。</p></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
` + EmailFoot

const DefaultPasswordResetTemplate = EmailHead + `
<tr><td colspan="3" height="40" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:` + emailFont + `;">{{siteName}}</p></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td>
    <h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:` + emailFont + `;">重置您的密码</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#525252;font-family:` + emailFont + `;">我们收到了您的密码重置请求。如果是您本人操作，请点击下方按钮。链接将在 {{expireMinutes}} 分钟后失效。</p>
  </td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><a href="{{resetLink}}" style="display:inline-block;padding:11px 24px;background-color:#1a1a1a;color:#ffffff;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;font-family:` + emailFont + `;">重置密码</a></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#ababab;font-family:` + emailFont + `;">如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#525252;word-break:break-all;font-family:'SF Mono',SFMono-Regular,ui-monospace,Menlo,monospace;">{{resetLink}}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#ababab;font-family:` + emailFont + `;">如果这不是您本人的操作，请忽略此邮件。</p>
  </td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
` + EmailFoot

const DefaultTestEmailTemplate = EmailHead + `
<tr><td colspan="3" height="40" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:` + emailFont + `;">{{siteName}}</p></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td>
    <h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:` + emailFont + `;">测试邮件</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#525252;font-family:` + emailFont + `;">SMTP 邮件服务配置正常，此邮件仅用于验证发信功能。</p>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#ababab;font-family:` + emailFont + `;">{{time}}</p>
  </td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
` + EmailFoot

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

// WrapEmailShell wraps a title + body HTML snippet into the standard email
// template shell. Used by notification emails (quota remind, channel alerts, etc.)
// so every outbound email shares the same visual style.
func WrapEmailShell(title string, bodyHTML string) string {
	font := emailFont
	shell := EmailHead + `
<tr><td colspan="3" height="40" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><p style="margin:0;font-size:12px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;color:#ababab;font-family:` + font + `;">` + SystemName + `</p></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr><td colspan="3" height="28" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><h1 style="margin:0 0 16px;font-size:21px;font-weight:400;color:#1a1a1a;font-family:` + font + `;">` + title + `</h1></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
<tr>
  <td width="48" style="font-size:1px;">&nbsp;</td>
  <td><div style="font-size:15px;line-height:1.6;color:#525252;font-family:` + font + `;">` + bodyHTML + `</div></td>
  <td width="48" style="font-size:1px;">&nbsp;</td>
</tr>
` + RenderTemplate(EmailFoot, map[string]string{"siteName": SystemName})
	return shell
}
