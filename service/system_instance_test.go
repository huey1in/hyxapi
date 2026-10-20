package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestReportCurrentSystemInstancePersistsRuntimeAndIdentity(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	previousDB, previousName := model.DB, common.NodeName
	previousSource, previousManual := common.NodeNameSource, common.NodeNameManuallyConfigured
	model.DB, common.NodeName = db, "test-system-reporter"
	common.NodeNameSource, common.NodeNameManuallyConfigured = common.NodeNameSourceManual, true
	t.Cleanup(func() {
		model.DB, common.NodeName = previousDB, previousName
		common.NodeNameSource, common.NodeNameManuallyConfigured = previousSource, previousManual
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&model.SystemInstance{}))
	for range 2 {
		require.NoError(t, ReportCurrentSystemInstance())
	}
	instances, err := model.ListSystemInstances()
	require.NoError(t, err)
	require.Len(t, instances, 1)
	var info SystemInstanceInfo
	require.NoError(t, common.UnmarshalJsonStr(instances[0].Info, &info))
	require.Equal(t, "test-system-reporter", info.Node.Name)
	require.True(t, info.Node.ManuallyConfigured)
	require.False(t, info.Node.ShouldConfigureManually)
	require.NotEmpty(t, info.Runtime.GOOS)
	require.NotEmpty(t, info.Runtime.GOARCH)
	require.Equal(t, common.StartTime, info.Runtime.StartedAt)
	require.Equal(t, common.Version, info.Runtime.Version)
	require.Equal(t, model.SystemInstanceStatusOnline, instances[0].ToResponse(common.GetTimestamp()).Status)
}
