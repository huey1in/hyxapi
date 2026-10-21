package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"gorm.io/gorm"
)

var ErrNotificationEmailUnverified = errors.New("Verify the notification email before using it.")

type NotificationEmailVerification struct {
	AuthSessionIdentity
	Email          string `json:"email"`
	CodeHash       string `json:"code_hash"`
	FailedAttempts int    `json:"failed_attempts"`
}

func CreateNotificationEmailVerification(identity AuthSessionIdentity, email, codeHash string) (string, *AuthFlow, error) {
	if email == "" || email != NormalizeEmail(email) || codeHash == "" {
		return "", nil, ErrAuthFlowInvalid
	}
	var token string
	var flow *AuthFlow
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockNotificationEmailUser(tx, identity); err != nil {
			return err
		}
		now := time.Now()
		var recent int64
		if err := tx.Model(&AuthFlow{}).Where("purpose = ? AND user_id = ? AND created_at > ?", AuthFlowPurposeNotificationEmail, identity.UserID, now.Add(-EmailBindingResendDelay)).Count(&recent).Error; err != nil {
			return err
		}
		if recent > 0 {
			return ErrEmailBindingResendWait
		}
		// A unique, HMACed time slot limits the destination across accounts and
		// processes. Delivery failures also retain this allowance.
		slot := fmt.Sprintf("%s:%d", email, now.Unix()/60)
		if err := ClaimExternalAuthAssertionWithTx(tx, "notification_email_limit", slot, now.Add(EmailBindingResendDelay)); err != nil {
			if errors.Is(err, ErrAuthFlowConsumed) {
				return ErrEmailBindingResendWait
			}
			return err
		}
		if err := tx.Model(&AuthFlow{}).Where("purpose = ? AND provider = ? AND created_at > ?", AuthFlowPurposeNotificationEmail, email, now.Add(-time.Hour)).Count(&recent).Error; err != nil {
			return err
		}
		if recent >= 5 {
			return ErrEmailBindingResendWait
		}
		payload, err := common.Marshal(NotificationEmailVerification{AuthSessionIdentity: identity, Email: email, CodeHash: codeHash})
		if err != nil {
			return err
		}
		if err := tx.Model(&AuthFlow{}).Where("purpose = ? AND user_id = ? AND consumed_at IS NULL", AuthFlowPurposeNotificationEmail, identity.UserID).Update("consumed_at", now).Error; err != nil {
			return err
		}
		token, flow, err = createAuthFlowWithTx(tx, AuthFlowCreate{
			Purpose: AuthFlowPurposeNotificationEmail, Provider: email, UserId: identity.UserID, SessionId: identity.SessionID,
			Payload: string(payload), ExpiresAt: now.Add(EmailBindingTTL),
		})
		return err
	})
	return token, flow, err
}

func lockNotificationEmailUser(tx *gorm.DB, identity AuthSessionIdentity) error {
	// A write first also serializes settings changes on SQLite. All operations
	// lock the account before the flow to keep a consistent lock order.
	if err := tx.Model(&User{}).Where("id = ?", identity.UserID).UpdateColumn("id", gorm.Expr("id")).Error; err != nil {
		return err
	}
	return ValidateAuthSessionWithTx(tx, identity)
}

func CompleteNotificationEmailVerification(identity AuthSessionIdentity, token, code string) error {
	var verificationError error
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockNotificationEmailUser(tx, identity); err != nil {
			return err
		}
		var flow AuthFlow
		match := AuthFlowMatch{Purpose: AuthFlowPurposeNotificationEmail, UserId: identity.UserID, SessionId: identity.SessionID}
		if err := applyAuthFlowMatch(tx, token, match).First(&flow).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAuthFlowInvalid
			}
			return err
		}
		if flow.ConsumedAt != nil {
			return ErrAuthFlowConsumed
		}
		if !flow.ExpiresAt.After(time.Now()) {
			return ErrAuthFlowExpired
		}
		var state NotificationEmailVerification
		if err := common.UnmarshalJsonStr(flow.Payload, &state); err != nil || state.AuthSessionIdentity != identity || state.Email == "" || state.Email != flow.Provider || state.CodeHash == "" {
			return ErrAuthFlowInvalid
		}
		if state.FailedAttempts >= EmailBindingMaxAttempts {
			return ErrEmailBindingLocked
		}
		code, err := common.ValidateNumericCode(code)
		if err != nil || !common.ValidatePasswordAndHash(code, state.CodeHash) {
			state.FailedAttempts++
			verificationError = ErrEmailBindingCodeInvalid
			if state.FailedAttempts >= EmailBindingMaxAttempts {
				verificationError = ErrEmailBindingLocked
			}
			payload, err := common.Marshal(state)
			if err != nil {
				return err
			}
			return tx.Model(&flow).Update("payload", string(payload)).Error
		}
		var user User
		if err := tx.Select("setting").First(&user, identity.UserID).Error; err != nil {
			return err
		}
		var settings dto.UserSetting
		if user.Setting != "" {
			if err := common.UnmarshalJsonStr(user.Setting, &settings); err != nil {
				return err
			}
		}
		settings.NotificationEmail, settings.NotificationEmailVerified = state.Email, true
		encoded, err := common.Marshal(settings)
		if err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", identity.UserID).Update("setting", string(encoded)).Error; err != nil {
			return err
		}
		return tx.Model(&flow).Update("consumed_at", time.Now()).Error
	})
	if err != nil {
		return err
	}
	if verificationError != nil {
		return verificationError
	}
	return InvalidateUserCache(identity.UserID)
}
