package model

import (
	"crypto/sha256"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

func ChannelMultiKeyRevision(channel *Channel) string {
	data, _ := common.Marshal(struct {
		Key  string
		Info ChannelInfo
	}{channel.Key, channel.ChannelInfo})
	return fmt.Sprintf("%x", sha256.Sum256(data))
}

// Commit only the credential fields; a status edit must not overwrite usage,
// routing or a credential list changed by another administrator or node.
func CommitChannelMultiKeyEdit(channel *Channel, revision string) error {
	var previous Channel
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(&previous, channel.Id).Error; err != nil {
			return err
		}
		if ChannelMultiKeyRevision(&previous) != revision {
			return fmt.Errorf("Channel keys changed. Refresh and try again.")
		}
		// Preserve a concurrent manual channel status. Only exhaustion-owned
		// disables may recover when credentials become available.
		channel.Status, channel.OtherInfo = previous.Status, previous.OtherInfo
		info := previous.GetOtherInfo()
		available := hasEnabledMultiKey(channel.GetKeys(), channel.ChannelInfo.MultiKeyStatusList)
		if !available && previous.Status == common.ChannelStatusEnabled {
			channel.Status = common.ChannelStatusManuallyDisabled
			info["status_reason"], info["status_time"] = ChannelStatusReasonAllKeysDisabled, common.GetTimestamp()
			channel.SetOtherInfo(info)
		} else if available && previous.Status != common.ChannelStatusEnabled && info["status_reason"] == ChannelStatusReasonAllKeysDisabled {
			channel.Status = common.ChannelStatusEnabled
			info["status_reason"], info["status_time"] = "", common.GetTimestamp()
			channel.SetOtherInfo(info)
		}
		updates := map[string]any{
			"key": channel.Key, "channel_info": channel.ChannelInfo,
		}
		if channel.Status != previous.Status {
			updates["status"], updates["other_info"] = channel.Status, channel.OtherInfo
			if err := tx.Model(&Ability{}).Where("channel_id = ?", channel.Id).Update("enabled", channel.Status == common.ChannelStatusEnabled).Error; err != nil {
				return err
			}
		}
		return tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(updates).Error
	})
	if err == nil {
		closeChangedChannelWebSockets(&previous, channel)
	}
	return err
}
