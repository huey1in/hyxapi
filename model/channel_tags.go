package model

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/wsmanager"
	"gorm.io/gorm"
)

type ChannelTagChanges struct {
	NewTag, ModelMapping, Models, Groups, ParamOverride, HeaderOverride *string
	Priority                                                            *int64
	Weight                                                              *uint
}

func validChannelTag(tag string) bool {
	return utf8.ValidString(tag) && utf8.RuneCountInString(tag) <= 255 && !strings.ContainsAny(tag, "\r\n\x00")
}

// Only selected fields are written. Routing is rebuilt from the locked, updated
// rows so tag, priority and explicit zero values stay consistent with channels.
func EditChannelsByTag(ctx context.Context, tag string, change ChannelTagChanges) (int, error) {
	if strings.TrimSpace(tag) == "" || !validChannelTag(tag) {
		return 0, fmt.Errorf("Invalid tag name")
	}
	updates := map[string]any{}
	if change.NewTag != nil {
		value := strings.TrimSpace(*change.NewTag)
		if !validChannelTag(value) {
			return 0, fmt.Errorf("Invalid tag name")
		}
		updates["tag"] = value
	}
	if change.Priority != nil {
		if *change.Priority < -maxSortablePriority || *change.Priority > maxSortablePriority {
			return 0, ErrChannelPriorityRange
		}
		updates["priority"] = *change.Priority
	}
	if change.Weight != nil {
		if uint64(*change.Weight) > 1<<32-1 {
			return 0, fmt.Errorf("Weight must be between 0 and 4294967295")
		}
		updates["weight"] = *change.Weight
	}
	if change.Models != nil {
		values := []string{}
		for _, value := range strings.Split(*change.Models, ",") {
			value = strings.TrimSpace(value)
			if value == "" {
				continue
			}
			if len(value) > 255 || strings.ContainsAny(value, "\r\n\x00") {
				return 0, fmt.Errorf("Invalid model name")
			}
			if !slices.Contains(values, value) {
				values = append(values, value)
			}
		}
		if len(values) > 1000 {
			return 0, fmt.Errorf("select at most 1000 models")
		}
		updates["models"] = strings.Join(values, ",")
	}
	if change.Groups != nil {
		value := strings.TrimSpace(*change.Groups)
		if len(value) > 64 || strings.ContainsAny(value, "\r\n\x00") {
			return 0, fmt.Errorf("Invalid channel groups")
		}
		updates["group"] = value
	}
	if change.ModelMapping != nil {
		value := strings.TrimSpace(*change.ModelMapping)
		if value != "" {
			var mapping map[string]string
			if json.Unmarshal([]byte(value), &mapping) != nil || mapping == nil {
				return 0, fmt.Errorf("Model mapping must be a valid JSON object")
			}
			for key, target := range mapping {
				if strings.TrimSpace(key) == "" || strings.TrimSpace(target) == "" {
					return 0, fmt.Errorf("Model mapping keys and values must not be empty")
				}
			}
		}
		updates["model_mapping"] = value
	}
	for field, pointer := range map[string]*string{"param_override": change.ParamOverride, "header_override": change.HeaderOverride} {
		if pointer == nil {
			continue
		}
		value := strings.TrimSpace(*pointer)
		if value != "" && !json.Valid([]byte(value)) {
			return 0, fmt.Errorf("Overrides must contain valid JSON")
		}
		updates[field] = value
	}
	if len(updates) == 0 {
		return 0, fmt.Errorf("Select at least one field to update")
	}
	count := 0
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := lockForUpdate(tx).Where("tag = ?", tag).Order("id").Find(&channels).Error; err != nil {
			return err
		}
		if len(channels) == 0 {
			return gorm.ErrRecordNotFound
		}
		for _, channel := range channels {
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(updates).Error; err != nil {
				return err
			}
			// Read through the same transaction, never the global DB/cache.
			if err := tx.First(&channel, channel.Id).Error; err != nil {
				return err
			}
			if err := channel.UpdateAbilities(tx); err != nil {
				return err
			}
		}
		count = len(channels)
		return nil
	})
	if err != nil {
		return 0, err
	}
	return count, nil
}

func SetChannelTagStatus(ctx context.Context, tag string, status int) (int, error) {
	if strings.TrimSpace(tag) == "" || !validChannelTag(tag) || (status != common.ChannelStatusEnabled && status != common.ChannelStatusManuallyDisabled) {
		return 0, fmt.Errorf("invalid channel tag or status")
	}
	ids := []int{}
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := lockForUpdate(tx).Where("tag = ?", tag).Order("id").Find(&channels).Error; err != nil {
			return err
		}
		if len(channels) == 0 {
			return gorm.ErrRecordNotFound
		}
		for _, channel := range channels {
			if status == common.ChannelStatusEnabled && channel.ChannelInfo.IsMultiKey && !hasEnabledMultiKey(channel.GetKeys(), channel.ChannelInfo.MultiKeyStatusList) {
				continue
			}
			info := channel.GetOtherInfo()
			info["status_reason"], info["status_time"] = "manual tag operation", common.GetTimestamp()
			channel.SetOtherInfo(info)
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{"status": status, "other_info": channel.OtherInfo}).Error; err != nil {
				return err
			}
			if err := tx.Model(&Ability{}).Where("channel_id = ?", channel.Id).Update("enabled", status == common.ChannelStatusEnabled).Error; err != nil {
				return err
			}
			ids = append(ids, channel.Id)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	if status == common.ChannelStatusManuallyDisabled {
		wsmanager.CloseChannelsAndBroadcast(ids, "channel disabled")
	}
	return len(ids), nil
}

func SetSelectedChannelTags(ctx context.Context, ids []int, tag *string) (int, error) {
	if len(ids) == 0 || len(ids) > 1000 {
		return 0, fmt.Errorf("select between 1 and 1000 channels")
	}
	ids = slices.Clone(ids)
	slices.Sort(ids)
	ids = slices.Compact(ids)
	if ids[0] <= 0 {
		return 0, fmt.Errorf("invalid channel ID")
	}
	if tag != nil {
		value := strings.TrimSpace(*tag)
		if !validChannelTag(value) {
			return 0, fmt.Errorf("Invalid tag name")
		}
		tag = &value
	}
	count := 0
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := lockForUpdate(tx).Where("id IN ?", ids).Order("id").Find(&channels).Error; err != nil {
			return err
		}
		if len(channels) != len(ids) {
			return fmt.Errorf("some selected channels no longer exist")
		}
		for _, channel := range channels {
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("tag", tag).Error; err != nil {
				return err
			}
			if err := tx.Model(&Ability{}).Where("channel_id = ?", channel.Id).Update("tag", tag).Error; err != nil {
				return err
			}
		}
		count = len(channels)
		return nil
	})
	if err != nil {
		return 0, err
	}
	return count, nil
}
