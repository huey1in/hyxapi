package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/require"
)

func TestAccountAndNotificationVerificationDeliverConfiguredTemplate(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	mailbox := newSecurityMailbox(t)
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = make(map[string]string, len(previous)+1)
	for key, value := range previous {
		common.OptionMap[key] = value
	}
	common.OptionMap[common.EmailTemplateVerificationKey] = `<html><body><section data-template="verification"><h1>{{title}}</h1><p>{{description}}</p><code>{{code}}</code><p>{{expireMinutes}} minutes</p><footer>{{notice}} {{siteName}}</footer></section></body></html>`
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})
	require.NoError(t, model.DB.Model(user).Update("email", "previous@example.com").Error)
	require.NoError(t, model.UpdateUserSetting(user.Id, dto.UserSetting{Language: "en"}))
	flow := startSecurityEmailBinding(t, identity, "new@example.com", service.VerificationMethodPassword)
	require.True(t, flow.OldEmailRequired)
	newCode, oldCode := mailbox.code(t, flow.Email), mailbox.code(t, "previous@example.com")
	require.NotEqual(t, newCode, oldCode)
	_, err := service.StartNotificationEmailVerification(identity, "notifications@example.com", "en")
	require.NoError(t, err)
	mailbox.mutex.Lock()
	defer mailbox.mutex.Unlock()
	for receiver, description := range map[string]string{
		flow.Email:                  "Confirm linking this email address to your account.",
		"previous@example.com":      "Confirm replacing your current address.",
		"notifications@example.com": "Confirm this mailbox to receive account notifications.",
	} {
		content := strings.Join(mailbox.mail[receiver], "\n")
		require.Contains(t, content, `data-template="verification"`)
		require.Contains(t, content, description)
		require.Contains(t, content, "10 minutes")
		require.NotContains(t, content, "{{")
	}
}
