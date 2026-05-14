package model

import (
	"time"
)

// CustomOAuthProvider stores configuration for custom OAuth providers
type CustomOAuthProvider struct {
	Id                    int    `json:"id" gorm:"primaryKey"`
	Name                  string `json:"name" gorm:"type:varchar(64);not null"`                          // Display name, e.g., "GitHub Enterprise"
	Slug                  string `json:"slug" gorm:"type:varchar(64);uniqueIndex;not null"`              // URL identifier, e.g., "github-enterprise"
	Icon                  string `json:"icon" gorm:"type:varchar(128);default:''"`                       // Icon name from @lobehub/icons
	Enabled               bool   `json:"enabled" gorm:"default:false"`                                   // Whether this provider is enabled
	ClientId              string `json:"client_id" gorm:"type:varchar(256)"`                             // OAuth client ID
	ClientSecret          string `json:"-" gorm:"type:varchar(512)"`                                     // OAuth client secret (not returned to frontend)
	AuthorizationEndpoint string `json:"authorization_endpoint" gorm:"type:varchar(512)"`                // Authorization URL
	TokenEndpoint         string `json:"token_endpoint" gorm:"type:varchar(512)"`                        // Token exchange URL
	UserInfoEndpoint      string `json:"user_info_endpoint" gorm:"type:varchar(512)"`                    // User info URL
	Scopes                string `json:"scopes" gorm:"type:varchar(256);default:'openid profile email'"` // OAuth scopes

	// Field mapping configuration (supports JSONPath via gjson)
	UserIdField      string `json:"user_id_field" gorm:"type:varchar(128);default:'sub'"`                 // User ID field path, e.g., "sub", "id", "data.user.id"
	UsernameField    string `json:"username_field" gorm:"type:varchar(128);default:'preferred_username'"` // Username field path
	DisplayNameField string `json:"display_name_field" gorm:"type:varchar(128);default:'name'"`           // Display name field path
	EmailField       string `json:"email_field" gorm:"type:varchar(128);default:'email'"`                 // Email field path

	// Advanced options
	WellKnown           string `json:"well_known" gorm:"type:varchar(512)"`            // OIDC discovery endpoint (optional)
	AuthStyle           int    `json:"auth_style" gorm:"default:0"`                    // 0=auto, 1=params, 2=header (Basic Auth)
	AccessPolicy        string `json:"access_policy" gorm:"type:text"`                 // JSON policy for access control based on user info
	AccessDeniedMessage string `json:"access_denied_message" gorm:"type:varchar(512)"` // Custom error message template when access is denied

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CustomOAuthProvider) TableName() string {
	return "custom_oauth_providers"
}

// GetAllCustomOAuthProviders returns all custom OAuth providers
func GetAllCustomOAuthProviders() ([]*CustomOAuthProvider, error) {
	var providers []*CustomOAuthProvider
	err := DB.Order("id asc").Find(&providers).Error
	return providers, err
}

// GetCustomOAuthProviderById returns a custom OAuth provider by ID
func GetCustomOAuthProviderById(id int) (*CustomOAuthProvider, error) {
	var provider CustomOAuthProvider
	err := DB.First(&provider, id).Error
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

