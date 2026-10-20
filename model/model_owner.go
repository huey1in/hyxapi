package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

// GetPreferredModelOwnerChannelTypes mirrors channel selection's priority,
// weight and stable ID ordering within the caller's available groups.
func GetPreferredModelOwnerChannelTypes(modelNames, groups []string) (map[string]int, error) {
	result := make(map[string]int)
	normalize := func(values []string) []any {
		seen := make(map[string]bool)
		out := make([]any, 0, len(values))
		for _, value := range values {
			value = strings.TrimSpace(value)
			if value != "" && !seen[value] {
				seen[value] = true
				out = append(out, value)
			}
		}
		return out
	}
	names := normalize(modelNames)
	if len(names) == 0 {
		return result, nil
	}
	var rows []struct {
		Model       string
		ChannelType int
	}
	query := DB.Table("abilities").
		Select("abilities.model as model, channels.type as channel_type").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where(clause.IN{Column: clause.Column{Table: "abilities", Name: "model"}, Values: names}).
		Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
		Order("COALESCE(abilities.priority, 0) DESC").Order("abilities.weight DESC").Order("abilities.channel_id ASC")
	if values := normalize(groups); len(values) > 0 {
		query = query.Where(clause.IN{Column: clause.Column{Table: "abilities", Name: "group"}, Values: values})
	}
	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		if _, exists := result[row.Model]; !exists {
			result[row.Model] = row.ChannelType
		}
	}
	return result, nil
}
