package model

import (
	"fmt"
	"gorm.io/gorm"
	"sort"
)

type LegacyChannelPriorityChange struct {
	ID       int   `json:"id"`
	Before   int64 `json:"before"`
	Priority int64 `json:"priority"`
}

type LegacyChannelPriorityMove struct {
	SourceID     int    `json:"source_id"`
	TargetID     int    `json:"target_id"`
	SourceBefore int64  `json:"source_before"`
	TargetBefore int64  `json:"target_before"`
	Placement    string `json:"placement"`
}

// MoveChannelPriority resolves neighbouring tiers across the whole repository,
// including channels hidden by pagination or filters. Dense tiers are shifted
// only as far as the next free integer, preserving peers and relative order.
func MoveChannelPriority(move LegacyChannelPriorityMove) ([]LegacyChannelPriorityChange, error) {
	if move.SourceID <= 0 || move.TargetID <= 0 || move.SourceID == move.TargetID ||
		(move.Placement != "before" && move.Placement != "after" && move.Placement != "same") {
		return nil, fmt.Errorf("invalid priority move")
	}
	var changes []LegacyChannelPriorityChange
	err := DB.Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := tx.Select("id", "priority").Order("id").Find(&channels).Error; err != nil {
			return err
		}
		var source, target *Channel
		levels := make(map[int64]bool)
		for i := range channels {
			channel := &channels[i]
			if channel.Id == move.SourceID {
				source = channel
			} else {
				levels[channel.GetPriority()] = true
			}
			if channel.Id == move.TargetID {
				target = channel
			}
		}
		if source == nil || target == nil || source.GetPriority() != move.SourceBefore || target.GetPriority() != move.TargetBefore {
			return fmt.Errorf("channel priority changed; refresh and retry")
		}
		priority := target.GetPriority()
		shift := make(map[int64]bool)
		direction := int64(0)
		if move.Placement != "same" {
			direction = 1
			if move.Placement == "after" {
				direction = -1
			}
			priority += direction
			for next := priority; levels[next]; next += direction {
				if next <= -1000000000 || next >= 1000000000 {
					return fmt.Errorf("channel priority is out of range")
				}
				shift[next] = true
			}
		}
		if priority < -1000000000 || priority > 1000000000 {
			return fmt.Errorf("channel priority is out of range")
		}
		for _, channel := range channels {
			before, after := channel.GetPriority(), channel.GetPriority()
			if channel.Id == source.Id {
				after = priority
			} else if shift[before] {
				after += direction
			}
			if before != after {
				changes = append(changes, LegacyChannelPriorityChange{ID: channel.Id, Before: before, Priority: after})
			}
		}
		if len(changes) > 500 {
			return fmt.Errorf("move affects over 500 channels; adjust priority tiers first")
		}
		return updateChannelPriorities(tx, changes)
	})
	return changes, err
}

// UpdateChannelPriorities compares the displayed values inside the same
// transaction as both channel and routing-ability updates.
func UpdateChannelPriorities(changes []LegacyChannelPriorityChange) error {
	if len(changes) == 0 || len(changes) > 500 {
		return fmt.Errorf("expected 1 to 500 priority changes")
	}
	changes = append([]LegacyChannelPriorityChange(nil), changes...)
	sort.Slice(changes, func(i, j int) bool { return changes[i].ID < changes[j].ID })
	return DB.Transaction(func(tx *gorm.DB) error { return updateChannelPriorities(tx, changes) })
}

func updateChannelPriorities(tx *gorm.DB, changes []LegacyChannelPriorityChange) error {
	for i, change := range changes {
		if change.ID <= 0 || (i > 0 && changes[i-1].ID == change.ID) || change.Priority < -1000000000 || change.Priority > 1000000000 {
			return fmt.Errorf("invalid priority change")
		}
		var channel Channel
		if err := tx.Select("id", "priority").First(&channel, change.ID).Error; err != nil {
			return err
		}
		if channel.GetPriority() != change.Before {
			return fmt.Errorf("channel priority changed; refresh and retry")
		}
		if change.Before != change.Priority {
			result := tx.Model(&Channel{}).Where("id = ? AND COALESCE(priority, 0) = ?", change.ID, change.Before).Update("priority", change.Priority)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return fmt.Errorf("channel priority changed; refresh and retry")
			}
		}
		if err := tx.Model(&Ability{}).Where("channel_id = ?", change.ID).Update("priority", change.Priority).Error; err != nil {
			return err
		}
	}
	return nil
}
