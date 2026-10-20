package model

import (
	"context"
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var (
	ErrTokenStatusExpired   = errors.New("expired token cannot be enabled")
	ErrTokenStatusExhausted = errors.New("exhausted token cannot be enabled")
)

// Change only status: quota consumption and concurrent metadata edits must not
// be replaced with the snapshot used to render the management page.
func SetUserTokenStatus(ctx context.Context, userID, id, status int) (*Token, error) {
	if userID <= 0 || id <= 0 || status != common.TokenStatusEnabled && status != common.TokenStatusDisabled {
		return nil, errors.New("invalid token status parameters")
	}
	var current Token
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", id, userID).First(&current).Error; err != nil {
			return err
		}
		if status == common.TokenStatusEnabled {
			if current.ExpiredTime != -1 && current.ExpiredTime <= common.GetTimestamp() {
				return ErrTokenStatusExpired
			}
			if !current.UnlimitedQuota && current.RemainQuota <= 0 {
				return ErrTokenStatusExhausted
			}
		}
		if err := invalidateTokenCacheForMutation(current.Key); err != nil {
			return err
		}
		if err := tx.Model(&Token{}).Where("id = ? AND user_id = ?", id, userID).Update("status", status).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND user_id = ?", id, userID).First(&current).Error
	})
	if err != nil {
		return nil, err
	}
	return &current, nil
}
