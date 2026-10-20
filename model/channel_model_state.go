package model

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var ErrChannelModelStateChanged = errors.New("Channel model configuration changed. Refresh the preview and try again.")

// Exclude live counters and the polling cursor: requests may change those while
// the detector is waiting for an upstream model list.
func ChannelModelStateRevision(channel *Channel) string {
	data, _ := common.Marshal([]any{
		channel.Id, channel.Type, channel.Key, channel.Status, channel.BaseURL,
		channel.Models, channel.ModelMapping, channel.OpenAIOrganization,
		channel.OtherSettings, channel.Setting, channel.Other, channel.Group,
		channel.Priority, channel.Weight, channel.HeaderOverride,
		channel.ChannelInfo.IsMultiKey, channel.ChannelInfo.MultiKeyMode,
		channel.ChannelInfo.MultiKeyStatusList,
	})
	return fmt.Sprintf("%x", sha256.Sum256(data))
}

// Save staged settings and routing in one transaction. A slow detector or an
// outdated preview cannot overwrite a more recent administrator edit.
func CommitChannelModelState(ctx context.Context, channel *Channel, expectedRevision, settings string, models *string) error {
	var saved Channel
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(&saved, channel.Id).Error; err != nil {
			return err
		}
		if expectedRevision != ChannelModelStateRevision(&saved) {
			return ErrChannelModelStateChanged
		}
		updates := map[string]any{"settings": settings}
		changed := models != nil && *models != saved.Models
		saved.OtherSettings = settings
		if models != nil {
			saved.Models = *models
			updates["models"] = *models
		}
		if err := tx.Model(&Channel{}).Where("id = ?", saved.Id).Updates(updates).Error; err != nil {
			return err
		}
		if changed {
			return saved.UpdateAbilities(tx)
		}
		return nil
	})
	if err == nil {
		*channel = saved
	}
	return err
}
