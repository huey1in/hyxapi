package model

import "gorm.io/gorm"

// BindGoogleForSessionWithTx claims the stable Google subject and writes only
// the binding column, under the session and user locks held by the OAuth flow.
func BindGoogleForSessionWithTx(tx *gorm.DB, identity AuthSessionIdentity, googleID string) error {
	if err := ValidateAuthSessionWithTx(tx, identity); err != nil {
		return err
	}
	var user User
	if err := tx.Select("id", "google_id").First(&user, identity.UserID).Error; err != nil {
		return err
	}
	if user.GoogleId != "" {
		return ErrExternalIdentityAlreadyClaimed
	}
	if err := ClaimExternalIdentityWithTx(tx, ExternalIdentityProviderGoogle, googleID, user.Id); err != nil {
		return err
	}
	result := tx.Model(&User{}).Where("id = ? AND (google_id = ? OR google_id IS NULL)", user.Id, "").Update("google_id", googleID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrExternalIdentityAlreadyClaimed
	}
	return nil
}
