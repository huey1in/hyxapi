package model

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var setupMutex sync.Mutex
var ErrSetupAlreadyInitialized = errors.New("The system is already initialized")

// Keep the administrator, site address, mode options and completion marker in one commit.
// ID 1 also fences concurrent initializers in separate server processes.
func InitializeSetup(ctx context.Context, username, password, confirmation string, selfUse, demo bool, serverAddress string) error {
	setupMutex.Lock()
	defer setupMutex.Unlock()
	if selfUse && demo {
		return errors.New("Select one usage mode")
	}
	serverAddress, err := common.NormalizeOrigin(serverAddress)
	if err != nil {
		return errors.New("Invalid parameters")
	}
	values := map[string]string{"SelfUseModeEnabled": strconv.FormatBool(selfUse), "DemoSiteEnabled": strconv.FormatBool(demo), "ServerAddress": serverAddress}
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var completed int64
		if err := tx.Model(&Setup{}).Count(&completed).Error; err != nil {
			return err
		}
		if completed > 0 {
			return ErrSetupAlreadyInitialized
		}
		var roots int64
		if err := tx.Model(&User{}).Where("role = ?", common.RoleRootUser).Count(&roots).Error; err != nil {
			return err
		}
		if roots == 0 {
			username = strings.TrimSpace(username)
			if !utf8.ValidString(username) || username == "" || utf8.RuneCountInString(username) > 20 {
				return errors.New("Username must contain between 1 and 20 characters")
			}
			if password != confirmation {
				return errors.New("Passwords do not match")
			}
			hash, err := common.HashAccountPassword(password)
			if err != nil {
				return err
			}
			user := User{Username: username, Password: hash, Role: common.RoleRootUser, Status: common.UserStatusEnabled, DisplayName: "Root User", Quota: 100000000, CreatedAt: common.GetTimestamp()}
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
		}
		for key, value := range values {
			if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "key"}}, DoUpdates: clause.AssignmentColumns([]string{"value"})}).Create(&Option{Key: key, Value: value}).Error; err != nil {
				return err
			}
		}
		return tx.Create(&Setup{ID: 1, Version: common.Version, InitializedAt: time.Now().Unix()}).Error
	})
	if err != nil {
		return err
	}
	for key, value := range values {
		if err := updateOptionMap(key, value); err != nil {
			return err
		}
	}
	return nil
}

type Setup struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	Version       string `json:"version" gorm:"type:varchar(50);not null"`
	InitializedAt int64  `json:"initialized_at" gorm:"type:bigint;not null"`
}

func GetSetup() *Setup {
	var setup Setup
	err := DB.First(&setup).Error
	if err != nil {
		return nil
	}
	return &setup
}
