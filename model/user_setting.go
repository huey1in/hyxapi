package model

import (
	"context"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PatchUserSetting merges against the locked current row. Independent forms
// must not restore a stale language, billing, or notification setting.
func PatchUserSetting(ctx context.Context, userID int, patch func(dto.UserSetting, int) (dto.UserSetting, error)) error {
	if userID <= 0 {
		return common.NewMessage("ID is empty!")
	}
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id", "role", "setting").First(&user, userID).Error; err != nil {
			return err
		}
		var current dto.UserSetting
		if user.Setting != "" {
			if err := common.Unmarshal([]byte(user.Setting), &current); err != nil {
				return err
			}
		}
		updated, err := patch(current, user.Role)
		if err != nil {
			return err
		}
		encoded, err := common.Marshal(updated)
		if err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", userID).Update("setting", string(encoded)).Error
	})
	if err != nil {
		return err
	}
	// Invalidating avoids a delayed cache write restoring an older settings blob.
	return InvalidateUserCache(userID)
}
