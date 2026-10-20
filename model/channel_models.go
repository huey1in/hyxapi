package model

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"gorm.io/gorm"
)

// Apply names to the latest stored list, preserving unrelated concurrent edits.
func MutateChannelModels(ctx context.Context, id, channelType int, add bool, names []string) ([]string, error) {
	if len(names) == 0 || len(names) > 1000 {
		return nil, fmt.Errorf("select between 1 and 1000 models")
	}
	selected := make(map[string]bool, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" || len(name) > 255 || strings.ContainsAny(name, ",\r\n") {
			return nil, fmt.Errorf("invalid model name")
		}
		selected[name] = true
	}
	var result []string
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var channel Channel
		if err := lockForUpdate(tx).First(&channel, id).Error; err != nil {
			return err
		}
		if channel.Type != channelType {
			return fmt.Errorf("unsupported channel type")
		}
		for _, name := range channel.GetModels() {
			name = strings.TrimSpace(name)
			if name != "" && (add || !selected[name]) && !slices.Contains(result, name) {
				result = append(result, name)
			}
		}
		if add {
			for _, name := range names {
				name = strings.TrimSpace(name)
				if !slices.Contains(result, name) {
					result = append(result, name)
				}
			}
		}
		channel.Models = strings.Join(result, ",")
		if err := tx.Model(&Channel{}).Where("id = ?", id).Update("models", channel.Models).Error; err != nil {
			return err
		}
		return channel.UpdateAbilities(tx)
	})
	if result == nil {
		result = []string{}
	}
	return result, err
}
