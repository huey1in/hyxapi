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
