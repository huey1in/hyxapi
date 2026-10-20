package model

import (
	"context"
	"errors"
	"math"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var ErrChannelBalanceChanged = errors.New("Channel credentials or balance settings changed. Refresh and try again.")

func balanceQuerySettings(channel *Channel) string {
	value := func(pointer *string) string {
		if pointer == nil {
			return ""
		}
		return *pointer
	}
	encoded, _ := common.Marshal([]any{channel.Type, channel.Key, channel.GetBaseURL(), value(channel.Setting), channel.OtherSettings, value(channel.HeaderOverride)})
	return string(encoded)
}

// A response for an old credential must not replace the balance for a newly
// edited channel. Live usage and routing fields are kept intact.
func CommitChannelBalanceSnapshot(ctx context.Context, channel *Channel, balance float64) error {
	if math.IsNaN(balance) || math.IsInf(balance, 0) {
		return errors.New("balance must be finite")
	}
	expected := balanceQuerySettings(channel)
	updated := common.GetTimestamp()
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current Channel
		if err := lockForUpdate(tx).First(&current, channel.Id).Error; err != nil {
			return err
		}
		if balanceQuerySettings(&current) != expected {
			return ErrChannelBalanceChanged
		}
		return tx.Model(&Channel{}).Where("id = ?", current.Id).Updates(map[string]any{"balance": balance, "balance_updated_time": updated}).Error
	})
	if err == nil {
		channel.Balance = balance
		channel.BalanceUpdatedTime = updated
	}
	return err
}
