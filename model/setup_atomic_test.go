package model

import (
	"context"
	"errors"
	"maps"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func checkSetupAtomic(t *testing.T, db *gorm.DB) {
	t.Helper()
	previousDB := DB
	previousSelf, previousDemo := operation_setting.SelfUseModeEnabled, operation_setting.DemoSiteEnabled
	previousAddress := system_setting.ServerAddress
	const setupAddress = "https://setup.example:8443"
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = maps.Clone(previousOptions)
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.Unlock()
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		operation_setting.SelfUseModeEnabled, operation_setting.DemoSiteEnabled = previousSelf, previousDemo
		system_setting.ServerAddress = previousAddress
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
	})
	require.NoError(t, db.AutoMigrate(&User{}, &Setup{}, &Option{}))
	count := func(value any) int64 { var n int64; require.NoError(t, db.Model(value).Count(&n).Error); return n }
	clear := func() {
		for _, value := range []any{&Setup{}, &User{}, &Option{}} {
			require.NoError(t, db.Unscoped().Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(value).Error)
		}
	}
	for _, input := range [][3]string{{"", "password123", "password123"}, {strings.Repeat("x", 21), "password123", "password123"}, {"root", "short", "short"}, {"root", "password123", "different"}, {"root", strings.Repeat("a", 129), strings.Repeat("a", 129)}} {
		require.Error(t, InitializeSetup(context.Background(), input[0], input[1], input[2], false, false, setupAddress))
		require.Zero(t, count(&User{}))
		require.Zero(t, count(&Option{}))
		require.Zero(t, count(&Setup{}))
	}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	require.ErrorIs(t, InitializeSetup(cancelled, "root", "password123", "password123", false, false, setupAddress), context.Canceled)
	require.Error(t, InitializeSetup(context.Background(), "root", "password123", "password123", true, true, setupAddress))
	for _, address := range []string{"", "null", "ftp://setup.example", "https://user:password@setup.example", "https://setup.example/setup", "https://setup.example?key=value", "https://setup.example#fragment"} {
		require.Error(t, InitializeSetup(context.Background(), "root", "password123", "password123", false, false, address), address)
		require.Zero(t, count(&User{}))
		require.Zero(t, count(&Option{}))
		require.Zero(t, count(&Setup{}))
		require.Equal(t, previousAddress, system_setting.ServerAddress)
	}
	// Failure of the completion marker must roll back both root and mode writes.
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register("setup-marker-failure", func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "Setup" {
			tx.AddError(errors.New("fixture marker failure"))
		}
	}))
	require.ErrorContains(t, InitializeSetup(context.Background(), "root", "password123", "password123", true, false, setupAddress), "fixture marker failure")
	require.Zero(t, count(&User{}))
	require.Zero(t, count(&Option{}))
	require.Zero(t, count(&Setup{}))
	require.Equal(t, previousSelf, operation_setting.SelfUseModeEnabled)
	require.Equal(t, previousAddress, system_setting.ServerAddress)
	require.NoError(t, db.Callback().Create().Remove("setup-marker-failure"))
	password := strings.Repeat("🙂", 128)
	require.NoError(t, InitializeSetup(context.Background(), " 管理员 ", password, password, true, false, setupAddress+"/"))
	var user User
	require.NoError(t, db.First(&user).Error)
	require.Equal(t, "管理员", user.Username)
	require.Equal(t, common.RoleRootUser, user.Role)
	require.True(t, common.ValidatePasswordAndHash(password, user.Password))
	require.True(t, operation_setting.SelfUseModeEnabled)
	require.False(t, operation_setting.DemoSiteEnabled)
	var address Option
	require.NoError(t, db.Where(&Option{Key: "ServerAddress"}).First(&address).Error)
	require.Equal(t, setupAddress, address.Value)
	require.Equal(t, setupAddress, system_setting.ServerAddress)
	require.Equal(t, setupAddress, common.OptionMap["ServerAddress"])
	require.ErrorIs(t, InitializeSetup(context.Background(), "another", "password123", "password123", false, true, "https://another.example"), ErrSetupAlreadyInitialized)
	require.Equal(t, setupAddress, system_setting.ServerAddress)
	require.NoError(t, db.Where(&Option{Key: "ServerAddress"}).First(&address).Error)
	require.Equal(t, setupAddress, address.Value)
	require.EqualValues(t, 1, count(&User{}))
	require.EqualValues(t, 1, count(&Setup{}))
	// Resuming an existing root needs no replacement password and persists modes.
	require.NoError(t, db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Setup{}).Error)
	require.NoError(t, InitializeSetup(context.Background(), "", "", "", false, true, setupAddress))
	var unchanged User
	require.NoError(t, db.First(&unchanged, user.Id).Error)
	require.Equal(t, user.Password, unchanged.Password)
	var demo Option
	require.NoError(t, db.Where("`key` = ?", "DemoSiteEnabled").First(&demo).Error)
	require.Equal(t, "true", demo.Value)
	require.False(t, operation_setting.SelfUseModeEnabled)
	require.True(t, operation_setting.DemoSiteEnabled)
	clear()
	results := make(chan error, 6)
	var workers sync.WaitGroup
	for range 6 {
		workers.Go(func() {
			results <- InitializeSetup(context.Background(), "root", "password123", "password123", false, false, setupAddress)
		})
	}
	workers.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		} else {
			require.ErrorIs(t, err, ErrSetupAlreadyInitialized)
		}
	}
	require.Equal(t, 1, success)
	require.EqualValues(t, 1, count(&User{}))
	require.EqualValues(t, 1, count(&Setup{}))
}

func TestInitializeSetupAtomic(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	pool, err := db.DB()
	require.NoError(t, err)
	pool.SetMaxOpenConns(1)
	t.Cleanup(func() { pool.Close() })
	checkSetupAtomic(t, db)
}

func TestInitializeSetupAtomicMySQL(t *testing.T) {
	checkSetupAtomic(t, openIsolatedMySQLMigrationDB(t))
}
