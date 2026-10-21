package service

import (
	"fmt"
	"html"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
)

type NotificationEmailData struct {
	FlowToken string `json:"flow_token"`
	Email     string `json:"email"`
	ExpiresAt int64  `json:"expires_at"`
	ResendAt  int64  `json:"resend_at"`
}

func StartNotificationEmailVerification(identity AuthIdentity, email, lang string) (*NotificationEmailData, error) {
	email, err := ValidateAccountEmail(email)
	if err != nil {
		return nil, err
	}
	codes, err := generateEmailBindingCodes(false)
	if err != nil {
		return nil, err
	}
	token, flow, err := model.CreateNotificationEmailVerification(identity, email, codes.NewHash)
	if err != nil {
		return nil, err
	}
	subject := i18n.Translate(lang, i18n.MsgNotificationEmailSubject, map[string]any{"SystemName": common.SystemName})
	content := fmt.Sprintf("<p>%s</p><p>%s</p><p>%s</p>",
		i18n.Translate(lang, i18n.MsgNotificationEmailIntro),
		i18n.Translate(lang, i18n.MsgEmailBindingCode, map[string]any{"Code": html.EscapeString(codes.New)}),
		i18n.Translate(lang, i18n.MsgEmailBindingNewValidity, map[string]any{"Minutes": int(model.EmailBindingTTL / time.Minute)}))
	if err := common.SendEmail(subject, email, content); err != nil {
		_, _ = model.ConsumeAuthFlow(token, model.AuthFlowMatch{Purpose: model.AuthFlowPurposeNotificationEmail, UserId: identity.UserID, SessionId: identity.SessionID})
		return nil, ErrEmailBindingDelivery
	}
	return &NotificationEmailData{FlowToken: token, Email: email, ExpiresAt: flow.ExpiresAt.Unix(), ResendAt: flow.CreatedAt.Add(model.EmailBindingResendDelay).Unix()}, nil
}
