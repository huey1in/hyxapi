package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVerificationEmailTemplateUsesContextAndEscapesValues(t *testing.T) {
	OptionMapRWMutex.Lock()
	previous := OptionMap
	OptionMap = map[string]string{}
	OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		OptionMapRWMutex.Lock()
		OptionMap = previous
		OptionMapRWMutex.Unlock()
	})
	content := RenderVerificationEmail(VerificationEmail{Code: "123456", ExpireMinutes: 7})
	require.Contains(t, content, "<!DOCTYPE html>")
	require.Contains(t, content, "123456")
	require.Contains(t, content, "7 分钟")
	require.NotContains(t, content, "{{")

	content = RenderVerificationEmail(VerificationEmail{
		Code: "654321", ExpireMinutes: 5, Title: "Confirm <email>",
		Description: `New "address"`, Notice: "Do not share & contact support",
	})
	require.Contains(t, content, "Confirm &lt;email&gt;")
	require.Contains(t, content, "New &#34;address&#34;")
	require.Contains(t, content, "Do not share &amp; contact support")
	require.Contains(t, content, `class="verification-code"`)
	require.Contains(t, content, "linear-gradient(115deg, #eef4ff 0%, #eef7f5 100%)")
	require.NotContains(t, content, "{{")

	OptionMapRWMutex.Lock()
	OptionMap[EmailTemplateVerificationKey] = `<main>{{siteName}}|{{title}}|{{description}}|{{code}}|{{expireMinutes}}|{{notice}}</main>`
	OptionMapRWMutex.Unlock()
	content = RenderVerificationEmail(VerificationEmail{
		Code: "654321", ExpireMinutes: 5, Title: "Confirm <email>",
		Description: `New "address"`, Notice: "Do not share & contact support",
	})
	require.True(t, strings.HasPrefix(content, "<main>"))
	require.Contains(t, content, "Confirm &lt;email&gt;")
	require.Contains(t, content, "New &#34;address&#34;")
	require.Contains(t, content, "654321|5|Do not share &amp; contact support")
	require.NotContains(t, content, "{{")
}

func TestBuiltInEmailTemplatesUseCurrentLayout(t *testing.T) {
	_, testEmail := RenderTestEmail()
	resetLink := "https://example.com/reset?token=example&email=test%40example.com"
	resetEmail := RenderTemplate(DefaultPasswordResetTemplate, map[string]string{
		"siteName":      "Example",
		"resetLink":     resetLink,
		"expireMinutes": "15",
	})
	require.Contains(t, resetEmail, `href="`+resetLink+`"`)
	require.Contains(t, resetEmail, "15 分钟")
	require.Contains(t, resetEmail, "<v:roundrect")
	require.Contains(t, testEmail, "SMTP 邮件服务配置正常")
	for name, content := range map[string]string{
		"password reset": resetEmail,
		"test email":     testEmail,
		"notification":   WrapEmailShell("账户通知", "<p>通知内容</p>"),
	} {
		t.Run(name, func(t *testing.T) {
			require.Contains(t, content, "<!DOCTYPE html>")
			require.Contains(t, content, "max-width: 560px")
			require.Contains(t, content, "background-color: #ffffff")
			require.Contains(t, content, "自动发送，请勿直接回复")
			require.Contains(t, content, "<!--[if mso]>")
			require.NotContains(t, content, "#f5f3ed")
			require.NotContains(t, content, "#fffdf7")
			require.NotContains(t, content, "{{")
		})
	}
}

func TestNotificationEmailEscapesTitleAndPreservesBodyHTML(t *testing.T) {
	body := `<p><strong>余额提醒</strong>：{{siteName}} &amp; details</p>`
	content := WrapEmailShell(`账户 <安全> & "通知"`, body)
	require.Contains(t, content, "账户 &lt;安全&gt; &amp; &#34;通知&#34;")
	require.NotContains(t, content, "<安全>")
	require.Contains(t, content, body)
	require.NotContains(t, content, "{{title}}")
	require.NotContains(t, content, "{{bodyHTML}}")
}
