package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func metadataFixture(t *testing.T) {
	t.Helper()
	isolatePricingConfig(t)
	for _, record := range []any{&Model{}, &Vendor{}, &Ability{}} {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(record).Error)
	}
	t.Cleanup(func() {
		for _, record := range []any{&Model{}, &Vendor{}, &Ability{}} {
			DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(record)
		}
	})
}

func TestPricingRefreshCreatesDefaultVendorWithoutRecursiveRefresh(t *testing.T) {
	metadataFixture(t)
	channel := &Channel{Name: "default-vendor", Type: 1, Status: 1, Models: "gpt-default-vendor", Group: "default"}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, DB.Create(&Ability{Group: "default", Model: channel.Models, ChannelId: channel.Id, Enabled: true}).Error)
	RefreshPricing()
	var vendor Vendor
	require.NoError(t, DB.Where("name = ?", "OpenAI").First(&vendor).Error)
	require.NotZero(t, vendor.Id)
	require.NotZero(t, vendor.CreatedTime)
	RefreshPricing()
	var count int64
	require.NoError(t, DB.Model(&Vendor{}).Where("name = ?", "OpenAI").Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestVendorOperationsRejectReferencesAndChangedPreview(t *testing.T) {
	metadataFixture(t)
	source, target, empty := &Vendor{Name: " Source "}, &Vendor{Name: "Target"}, &Vendor{Name: "Empty"}
	for _, vendor := range []*Vendor{source, target, empty} {
		require.NoError(t, vendor.Insert())
	}
	require.Error(t, (&Vendor{Name: "source"}).Insert(), "names are unique after trim and case folding")
	item := &Model{ModelName: "vendor-operation", VendorID: source.Id, Status: 1, SyncOfficial: 1}
	require.NoError(t, item.Insert())
	require.Error(t, DeleteVendors([]int{source.Id, empty.Id}))
	_, err := GetVendorByID(empty.Id)
	require.NoError(t, err, "referenced vendor rejects the entire delete")
	operation := VendorOperation{Action: "merge", VendorIDs: []int{source.Id}, TargetVendorID: target.Id}
	preview, err := PreviewVendorOperation(operation)
	require.NoError(t, err)
	operation.ExpectedVersion = preview.Version
	require.NoError(t, DB.Model(item).Update("description", "concurrent edit").Error)
	_, err = ApplyVendorOperation(operation)
	require.ErrorIs(t, err, ErrVendorConflict)
	require.NoError(t, DB.First(item, item.Id).Error)
	require.Equal(t, source.Id, item.VendorID)
	preview, err = PreviewVendorOperation(operation)
	require.NoError(t, err)
	operation.ExpectedVersion = preview.Version
	result, err := ApplyVendorOperation(operation)
	require.NoError(t, err)
	require.Equal(t, []int{item.Id}, result.UpdatedModels)
	require.NoError(t, DB.First(item, item.Id).Error)
	require.Equal(t, target.Id, item.VendorID)
	_, err = GetVendorByID(source.Id)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	linked, total, err := SearchVendors("", 0, -1, "linked")
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.EqualValues(t, 1, linked[0].ModelCount)
	stale, err := GetVendorByID(target.Id)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Vendor{}).Where("id = ?", target.Id).Update("description", "changed").Error)
	stale.Name = "Renamed"
	require.ErrorIs(t, stale.Update(), ErrVendorConflict)
}

func TestMetadataSyncIsAtomicAndUpdatesOnlySelectedFields(t *testing.T) {
	metadataFixture(t)
	item := &Model{ModelName: "selected-fields", Description: "keep local", Icon: "old", Status: 1, SyncOfficial: 1}
	require.NoError(t, item.Insert())
	update := MetadataSyncUpdate{MetadataSyncSelection: MetadataSyncSelection{ModelName: item.ModelName, RecordVersion: MetadataRecordVersion(item, nil, nil), Fields: []string{"icon"}}, Values: MetadataValues{Description: "replace", Icon: "new", Status: 1}}
	create := MetadataSyncUpdate{MetadataSyncSelection: MetadataSyncSelection{ModelName: "atomic-new", RecordVersion: MetadataRecordVersion(nil, nil, nil), Create: true}, Values: MetadataValues{Vendor: "New Vendor", Status: 1}}
	require.NoError(t, DB.Model(item).Update("tags", "concurrent").Error)
	_, err := ApplyMetadataSync([]MetadataSyncUpdate{create, update}, map[string]Vendor{"New Vendor": {Name: "New Vendor"}})
	require.ErrorIs(t, err, ErrMetadataSyncConflict)
	var count int64
	require.NoError(t, DB.Model(&Vendor{}).Count(&count).Error)
	require.Zero(t, count)
	require.NoError(t, DB.Model(&Model{}).Where("model_name = ?", "atomic-new").Count(&count).Error)
	require.Zero(t, count, "stale selection rolls back the whole batch")
	require.NoError(t, DB.First(item, item.Id).Error)
	update.RecordVersion = MetadataRecordVersion(item, nil, nil)
	_, err = ApplyMetadataSync([]MetadataSyncUpdate{create, update}, map[string]Vendor{"New Vendor": {Name: "New Vendor"}})
	require.NoError(t, err)
	require.NoError(t, DB.First(item, item.Id).Error)
	require.Equal(t, "keep local", item.Description)
	require.Equal(t, "new", item.Icon)
	require.Equal(t, "concurrent", item.Tags)
	require.NoError(t, DB.Model(item).Update("sync_official", 0).Error)
	_, err = ApplyMetadataSync([]MetadataSyncUpdate{update}, nil)
	require.ErrorContains(t, err, "disabled")
}

func TestMetadataDeleteRemovesOnlySelectedChannelAndPriceNames(t *testing.T) {
	metadataFixture(t)
	remove, keep := &Model{ModelName: "delete-exact", Status: 1}, &Model{ModelName: "keep-exact", Status: 1}
	for _, item := range []*Model{remove, keep} {
		require.NoError(t, item.Insert())
		require.NoError(t, SaveModelPricing(&ModelPricing{ModelName: item.ModelName, Enabled: true, InputPrice: 2}))
	}
	channel := &Channel{Name: "metadata-delete", Models: remove.ModelName + "," + keep.ModelName, Group: "default", Status: 1, Key: "retain-private-key"}
	require.NoError(t, DB.Create(channel).Error)
	require.NoError(t, channel.UpdateAbilities(nil))
	removePlugin := billing_setting.PluginBillingExprKey("fixture", remove.ModelName)
	keepPlugin := billing_setting.PluginBillingExprKey("fixture", keep.ModelName)
	require.NoError(t, mutateModelPricingOptions(func(_ *gorm.DB, values map[string]map[string]any) error {
		values[billing_setting.PluginBillingExprOption][removePlugin] = `tier("base", 0)`
		values[billing_setting.PluginBillingExprOption][keepPlugin] = `tier("base", 0)`
		return nil
	}))
	result, err := DeleteModelMetadata([]int{remove.Id}, true, true)
	require.NoError(t, err)
	require.Equal(t, 1, result.UpdatedChannels)
	require.NoError(t, DB.First(channel, channel.Id).Error)
	require.Equal(t, keep.ModelName, channel.Models)
	require.Equal(t, "retain-private-key", channel.Key)
	_, exists := GetModelPricing(remove.ModelName)
	require.False(t, exists)
	_, exists = GetModelPricing(keep.ModelName)
	require.True(t, exists)
	_, exists = billing_setting.GetPluginBillingExpr("fixture", remove.ModelName)
	require.False(t, exists)
	_, exists = billing_setting.GetPluginBillingExpr("fixture", keep.ModelName)
	require.True(t, exists)
	_, err = DeleteModelMetadata([]int{keep.Id}, true, false)
	require.NoError(t, err)
	var abilities int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", channel.Id).Count(&abilities).Error)
	require.Zero(t, abilities, "removing the final model must not leave an empty model route")
	_, exists = GetModelPricing(keep.ModelName)
	require.True(t, exists, "pricing removal is opt-in")
}

func TestMetadataRuleDeleteDoesNotExpandIntoConcreteRoutes(t *testing.T) {
	metadataFixture(t)
	rule := &Model{ModelName: "rule-", NameRule: NameRulePrefix, Status: 1}
	require.NoError(t, rule.Insert())
	_, err := DeleteModelMetadata([]int{rule.Id}, true, false)
	require.Error(t, err)
	require.NoError(t, DB.First(&Model{}, rule.Id).Error)
	require.Error(t, (&Model{ModelName: "bad-vendor", VendorID: 99999}).Insert())
	require.Error(t, (&Model{ModelName: " "}).Insert())
	require.ErrorIs(t, (&Model{Id: 99999, ModelName: "missing"}).Update(), gorm.ErrRecordNotFound)
}
