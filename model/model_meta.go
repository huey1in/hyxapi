package model

import (
	"errors"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"gorm.io/gorm"
)

const (
	NameRuleExact = iota
	NameRulePrefix
	NameRuleContains
	NameRuleSuffix
)

type ModelSquareState string

const (
	ModelSquareVisible     ModelSquareState = "visible"
	ModelSquareUnavailable ModelSquareState = "unavailable"
	ModelSquareHidden      ModelSquareState = "hidden"
	ModelSquarePartial     ModelSquareState = "partial"
)

type BoundChannel struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

type Model struct {
	Id                 int            `json:"id"`
	ModelName          string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description        string         `json:"description,omitempty" gorm:"type:text"`
	Icon               string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags               string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
	VendorID           int            `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints          string         `json:"endpoints,omitempty" gorm:"type:text"`
	SupportedEndpoints []string       `json:"supported_endpoints,omitempty" gorm:"-"`
	Status             int            `json:"status" gorm:"default:1"`
	SyncOfficial       int            `json:"sync_official" gorm:"default:1"`
	CreatedTime        int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt          gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	EnableGroups  []string       `json:"enable_groups,omitempty" gorm:"-"`
	QuotaTypes    []int          `json:"quota_types,omitempty" gorm:"-"`
	NameRule      int            `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`

	HasMetadata            bool             `json:"has_metadata" gorm:"-"`
	ConfiguredChannelCount int              `json:"configured_channel_count" gorm:"-"`
	SquareState            ModelSquareState `json:"square_state" gorm:"-"`
}

// MatchesName applies a metadata rule to a concrete channel model name.
func (mi *Model) MatchesName(name string) bool {
	switch mi.NameRule {
	case NameRulePrefix:
		return strings.HasPrefix(name, mi.ModelName)
	case NameRuleSuffix:
		return strings.HasSuffix(name, mi.ModelName)
	case NameRuleContains:
		return strings.Contains(name, mi.ModelName)
	default:
		return name == mi.ModelName
	}
}

// resolveModelMetadata preserves catalog precedence: exact, prefix, suffix,
// then contains. The first matching record within a rule type wins.
func resolveModelMetadata(records []Model, names []string) map[string]*Model {
	resolved := make(map[string]*Model)
	for i := range records {
		if records[i].NameRule == NameRuleExact {
			resolved[records[i].ModelName] = &records[i]
		}
	}
	for _, rule := range []int{NameRulePrefix, NameRuleSuffix, NameRuleContains} {
		for i := range records {
			metadata := &records[i]
			if metadata.NameRule != rule {
				continue
			}
			for _, name := range names {
				if _, exists := resolved[name]; !exists && metadata.MatchesName(name) {
					resolved[name] = metadata
				}
			}
		}
	}
	return resolved
}

// FillModelSquareStates applies the same metadata policy as the public catalog
// to live routes, then aggregates concrete models for metadata rule rows.
func FillModelSquareStates(rows []*Model, configured map[string][]int, connections []ModelConnection) error {
	var metadata []Model
	if err := DB.Find(&metadata).Error; err != nil {
		return err
	}
	nameSet := make(map[string]struct{}, len(configured))
	for name := range configured {
		nameSet[name] = struct{}{}
	}
	for _, row := range rows {
		if row != nil && row.NameRule == NameRuleExact {
			nameSet[row.ModelName] = struct{}{}
		}
	}
	names := make([]string, 0, len(nameSet))
	for name := range nameSet {
		names = append(names, name)
	}
	resolved := resolveModelMetadata(metadata, names)
	available := make(map[string]bool)
	for _, connection := range connections {
		available[connection.Model] = true
	}
	states := make(map[string]ModelSquareState, len(names))
	for _, name := range names {
		state := ModelSquareUnavailable
		if policy := resolved[name]; policy != nil && policy.Status != 1 {
			state = ModelSquareHidden
		} else if available[name] {
			state = ModelSquareVisible
		}
		states[name] = state
	}
	for _, row := range rows {
		if row == nil {
			continue
		}
		if row.NameRule == NameRuleExact {
			row.SquareState = states[row.ModelName]
			continue
		}
		total, visible, hidden := 0, 0, 0
		for name := range configured {
			if !row.MatchesName(name) {
				continue
			}
			total++
			switch states[name] {
			case ModelSquareVisible:
				visible++
			case ModelSquareHidden:
				hidden++
			}
		}
		row.SquareState = ModelSquareUnavailable
		switch {
		case total == 0:
			if row.Status != 1 {
				row.SquareState = ModelSquareHidden
			}
		case hidden == total:
			row.SquareState = ModelSquareHidden
		case visible == total:
			row.SquareState = ModelSquareVisible
		case visible > 0:
			row.SquareState = ModelSquarePartial
		}
	}
	return nil
}

// GetConfiguredModelChannels includes disabled channels and reads no credentials.
func GetConfiguredModelChannels() (map[string][]int, error) {
	var channels []Channel
	if err := DB.Select("id", "models").Find(&channels).Error; err != nil {
		return nil, err
	}
	configured := make(map[string][]int)
	for _, channel := range channels {
		for _, name := range normalizeLookupValues(channel.GetModels()) {
			configured[name] = append(configured[name], channel.Id)
		}
	}
	return configured, nil
}

// SearchModelsWithChannels augments metadata with concrete configured names.
// Synthetic rows never persist and never affect the public pricing catalog.
func SearchModelsWithChannels(keyword, vendor, status, syncOfficial string, offset, limit int) ([]*Model, int64, error) {
	records, _, err := SearchModels(keyword, vendor, status, syncOfficial, 0, -1)
	if err != nil {
		return nil, 0, err
	}
	_, filterStatus := parseModelStatusFilter(status)
	_, filterSync := parseModelSyncFilter(syncOfficial)
	if !filterStatus && !filterSync && (vendor == "" || vendor == "0") {
		configured, err := GetConfiguredModelChannels()
		if err != nil {
			return nil, 0, err
		}
		var exactNames []string
		if err := DB.Model(&Model{}).Where("name_rule = ?", NameRuleExact).Pluck("model_name", &exactNames).Error; err != nil {
			return nil, 0, err
		}
		for _, name := range exactNames {
			delete(configured, name)
		}
		names := make([]string, 0, len(configured))
		for name := range configured {
			if keyword == "" || strings.Contains(strings.ToLower(name), strings.ToLower(keyword)) {
				names = append(names, name)
			}
		}
		sort.Strings(names)
		for _, name := range names {
			records = append(records, &Model{ModelName: name, NameRule: NameRuleExact})
		}
	}
	total := len(records)
	if offset < 0 {
		offset = 0
	}
	if offset >= total {
		return []*Model{}, int64(total), nil
	}
	end := total
	if limit >= 0 && limit < total-offset {
		end = offset + limit
	}
	return records[offset:end], int64(total), nil
}

func (mi *Model) Insert() error {
	mi.Id = 0
	return metadataTransaction(func(tx *gorm.DB) error {
		if err := validateModelMetadata(tx, mi); err != nil {
			return err
		}
		if err := validateModelVendor(tx, mi.VendorID); err != nil {
			return err
		}
		now := common.GetTimestamp()
		mi.CreatedTime, mi.UpdatedTime = now, now
		status, syncOfficial := mi.Status, mi.SyncOfficial
		if err := tx.Create(mi).Error; err != nil {
			return err
		}
		mi.Status, mi.SyncOfficial = status, syncOfficial
		return tx.Model(&Model{}).Where("id = ?", mi.Id).Updates(map[string]any{"status": status, "sync_official": syncOfficial}).Error
	})
}

func IsModelNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func (mi *Model) Update() error {
	return metadataTransaction(func(tx *gorm.DB) error {
		if mi.Id <= 0 {
			return errors.New("invalid model ID")
		}
		var saved Model
		if err := tx.First(&saved, mi.Id).Error; err != nil {
			return err
		}
		if err := validateModelMetadata(tx, mi); err != nil {
			return err
		}
		if err := validateModelVendor(tx, mi.VendorID); err != nil {
			return err
		}
		mi.UpdatedTime = common.GetTimestamp()
		return tx.Model(&Model{}).Where("id = ?", mi.Id).
			Select("model_name", "description", "icon", "tags", "vendor_id", "endpoints", "status", "sync_official", "name_rule", "updated_time").Updates(mi).Error
	})
}

func validateModelMetadata(tx *gorm.DB, item *Model) error {
	item.ModelName = strings.TrimSpace(item.ModelName)
	if item.ModelName == "" || utf8.RuneCountInString(item.ModelName) > 128 {
		return errors.New("model name must contain between 1 and 128 characters")
	}
	if item.SyncOfficial != 0 && item.SyncOfficial != 1 {
		return errors.New("invalid metadata sync setting")
	}
	if err := ValidateMetadataValues(MetadataValues{Icon: item.Icon, Tags: item.Tags, Endpoints: item.Endpoints, Status: item.Status, NameRule: item.NameRule}); err != nil {
		return err
	}
	var count int64
	if err := tx.Model(&Model{}).Where("model_name = ? AND id <> ?", item.ModelName, item.Id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("model name already exists")
	}
	return nil
}

func SetModelMetadataStatus(id, status int) error {
	if id <= 0 || (status != 0 && status != 1) {
		return errors.New("invalid model visibility")
	}
	return metadataTransaction(func(tx *gorm.DB) error {
		var saved Model
		if err := tx.First(&saved, id).Error; err != nil {
			return err
		}
		return tx.Model(&saved).Updates(map[string]any{"status": status, "updated_time": common.GetTimestamp()}).Error
	})
}

func (mi *Model) Delete() error {
	_, err := DeleteModelMetadata([]int{mi.Id}, false, false)
	return err
}

type ModelDeleteResult struct {
	DeletedCount    int `json:"deleted_count"`
	UpdatedChannels int `json:"updated_channels"`
}

// DeleteModelMetadata optionally removes exact model names from every channel.
// Channel removal requires exact-match metadata records. Pricing removal
// clears the selected names without expanding metadata matching rules.
func DeleteModelMetadata(ids []int, removeFromChannels, removePricing bool) (ModelDeleteResult, error) {
	result := ModelDeleteResult{}
	if len(ids) == 0 || len(ids) > 1000 {
		return result, errors.New("select between 1 and 1000 models")
	}
	selected := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return result, errors.New("invalid model ID")
		}
		selected[id] = struct{}{}
	}
	modelIDs := make([]int, 0, len(selected))
	for id := range selected {
		modelIDs = append(modelIDs, id)
	}
	sort.Ints(modelIDs)
	names := make(map[string]struct{}, len(modelIDs))
	deleteRecords := func(tx *gorm.DB) error {
		var records []Model
		if err := lockForUpdate(tx).Where("id IN ?", modelIDs).Order("id").Find(&records).Error; err != nil {
			return err
		}
		if len(records) != len(modelIDs) {
			return errors.New("selected models changed; reload before deleting")
		}
		for _, record := range records {
			if removeFromChannels && record.NameRule != NameRuleExact {
				return errors.New("only exact-match models can be removed from channels")
			}
			names[record.ModelName] = struct{}{}
		}
		if removeFromChannels {
			var channels []Channel
			// Read only routing fields. Lock channels in a consistent order, then
			// update models and abilities in the same transaction as metadata.
			if err := lockForUpdate(tx).Select("id", "models", "status", "group", "priority", "weight", "tag").Order("id").Find(&channels).Error; err != nil {
				return err
			}
			for _, channel := range channels {
				models := channel.GetModels()
				remaining := make([]string, 0, len(models))
				for _, name := range models {
					if _, remove := names[strings.TrimSpace(name)]; !remove {
						remaining = append(remaining, name)
					}
				}
				if len(remaining) == len(models) {
					continue
				}
				channel.Models = strings.Join(remaining, ",")
				if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("models", channel.Models).Error; err != nil {
					return err
				}
				if err := channel.UpdateAbilities(tx); err != nil {
					return err
				}
				result.UpdatedChannels++
			}
		}
		if err := tx.Where("id IN ?", modelIDs).Delete(&Model{}).Error; err != nil {
			return err
		}
		result.DeletedCount = len(records)
		return nil
	}
	var err error
	if removePricing {
		// Use the pricing mutation path so both option persistence and runtime
		// publication stay serialized with ordinary pricing saves. All database
		// writes share one transaction; runtime prices publish only after commit.
		metadataMutationMu.Lock()
		defer metadataMutationMu.Unlock()
		err = mutateModelPricingOptions(func(tx *gorm.DB, values map[string]map[string]any) error {
			if err := lockMetadataMutation(tx); err != nil {
				return err
			}
			if err := deleteRecords(tx); err != nil {
				return err
			}
			for key, entries := range values {
				for name := range entries {
					modelName := name
					if key == billing_setting.PluginBillingExprOption {
						_, parsed, ok := billing_setting.SplitPluginBillingExprKey(name)
						if ok {
							modelName = parsed
						}
					}
					if _, remove := names[modelName]; remove {
						delete(entries, name)
					}
				}
			}
			selectedNames := make([]string, 0, len(names))
			for name := range names {
				selectedNames = append(selectedNames, name)
			}
			return tx.Where("model_name IN ?", selectedNames).Delete(&ModelPricing{}).Error
		})
	} else {
		err = metadataTransaction(deleteRecords)
	}
	if err != nil {
		return ModelDeleteResult{}, err
	}
	if removePricing {
		InvalidateModelPricingCache()
	}
	if result.UpdatedChannels > 0 {
		InitChannelCache()
	}
	RefreshPricing()
	return result, nil
}

func GetVendorModelCounts() (map[int64]int64, error) {
	var stats []struct {
		VendorID int64
		Count    int64
	}
	if err := DB.Model(&Model{}).
		Select("vendor_id as vendor_id, count(*) as count").
		Group("vendor_id").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]int64, len(stats))
	for _, s := range stats {
		m[s.VendorID] = s.Count
	}
	return m, nil
}

// ModelConnection describes an enabled route independently of catalog visibility or price.
type ModelConnection struct {
	AbilityWithChannel
	ChannelName string `json:"channel_name"`
}

func GetModelConnections() ([]ModelConnection, error) {
	var connections []ModelConnection
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type, channels.name as channel_name").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
		Order("abilities.model, abilities.channel_id").
		Scan(&connections).Error
	return connections, err
}

func normalizeLookupValues(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func SearchModels(keyword string, vendor string, status string, syncOfficial string, offset int, limit int) ([]*Model, int64, error) {
	var models []*Model
	db := DB.Model(&Model{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
	}
	if vendor != "" {
		if vid, err := strconv.Atoi(vendor); err == nil {
			db = db.Where("models.vendor_id = ?", vid)
		} else {
			db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
		}
	}
	if statusValue, ok := parseModelStatusFilter(status); ok {
		db = db.Where("models.status = ?", statusValue)
	}
	if syncValue, ok := parseModelSyncFilter(syncOfficial); ok {
		db = db.Where("models.sync_official = ?", syncValue)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := db.Order("models.id DESC").Offset(offset).Limit(limit).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	return models, total, nil
}

// parseModelStatusFilter maps UI/API status values to the models.status column.
// Returns ok=false when no status filter should be applied.
func parseModelStatusFilter(status string) (value int, ok bool) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "", "all":
		return 0, false
	case "enabled", "1":
		return 1, true
	case "disabled", "0":
		return 0, true
	default:
		n, err := strconv.Atoi(status)
		if err != nil {
			return 0, false
		}
		return n, true
	}
}

// parseModelSyncFilter maps UI/API sync values to the models.sync_official column.
// Returns ok=false when no sync filter should be applied.
func parseModelSyncFilter(syncOfficial string) (value int, ok bool) {
	switch strings.ToLower(strings.TrimSpace(syncOfficial)) {
	case "", "all":
		return 0, false
	case "yes", "1":
		return 1, true
	case "no", "0":
		return 0, true
	default:
		n, err := strconv.Atoi(syncOfficial)
		if err != nil {
			return 0, false
		}
		return n, true
	}
}
