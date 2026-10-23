package main

import (
	"strings"
	"testing"
)

func TestRecipientMustBeOneAddress(t *testing.T) {
	for _, invalid := range []string{"", "not-an-address", "a@example.com;b@example.com", "a@example.com,b@example.com", "a@example.com\r\nBcc: b@example.com"} {
		if _, err := recipientAddress(invalid); err == nil {
			t.Fatalf("accepted invalid recipient %q", invalid)
		}
	}
	if got, err := recipientAddress(" Notice <notice@example.com> "); err != nil || got != "notice@example.com" {
		t.Fatalf("recipient = %q, %v", got, err)
	}
}

const configuredTemplate = `<!DOCTYPE html><html><head><title>{{siteName}} · 密码重置</title></head>
<body style="background-color: #ffffff"><div aria-hidden="true">{{siteName}} 密码重置，请在 {{expireMinutes}} 分钟内完成操作。</div>
<table class="configured-brand"><tr><td><h1 class="email-heading">重置您的密码</h1><p>我们收到了您的密码重置请求。</p></td></tr>
<tr><td style="background-image: linear-gradient(115deg, #eef4ff 0%, #eef7f5 100%);">
<!--[if mso]><v:roundrect href="{{resetLink}}"><center>重置密码</center></v:roundrect><![endif]-->
<a href="{{resetLink}}">重置密码</a><p>链接将在 <strong>{{expireMinutes}} 分钟</strong>后失效</p></td></tr>
<tr><td><a href="{{resetLink}}">{{resetLink}}</a><p>此链接仅用于本次密码重置，请勿向他人转发。</p></td></tr>
<tr><td>{{siteName}}</td></tr></table></body></html>`

func TestNoticeUsesConfiguredTemplateAndReceiptRelativeDeadline(t *testing.T) {
	subject, body, err := renderNotice("https://example.com/old?redirect=ignored#fragment", configuredTemplate)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(subject, "24 小时") {
		t.Fatal("subject omits the deadline")
	}
	for _, expected := range []string{"<!DOCTYPE html>", "收到本邮件后 24 小时内", "将被封禁", "https://example.com/personal?tab=account", "已完成邮箱绑定", `class="configured-brand"`, "linear-gradient(115deg, #eef4ff", "<v:roundrect"} {
		if !strings.Contains(body, expected) {
			t.Errorf("notice omits %q", expected)
		}
	}
	for _, unexpected := range []string{"redirect=ignored", "{{", "#fragment", "密码重置", "重置密码", "#f5f3ed", "#fffdf7"} {
		if strings.Contains(body, unexpected) {
			t.Errorf("notice contains %q", unexpected)
		}
	}
	for _, invalid := range []string{"", "javascript:alert(1)", "https://user:password@example.com", "/personal"} {
		if _, _, err := renderNotice(invalid, configuredTemplate); err == nil {
			t.Errorf("accepted invalid site URL %q", invalid)
		}
	}
	for _, missing := range []string{"", "<html><body>{{resetLink}}</body></html>"} {
		if _, _, err := renderNotice("https://example.com", missing); err == nil {
			t.Error("missing or incompatible configured template must not fall back to the old shell")
		}
	}
}
