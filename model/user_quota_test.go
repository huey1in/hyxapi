package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUpdateUserUsedQuotaAdjustsOnlyUsedQuota(t *testing.T) {
	for _, mode := range []string{"immediate", "batched"} {
		t.Run(mode, func(t *testing.T) {
			truncateTables(t)
			previousBatch := common.BatchUpdateEnabled
			common.BatchUpdateEnabled = mode == "batched"
			t.Cleanup(func() { common.BatchUpdateEnabled = previousBatch })
			user := &User{Username: "used-quota-delta-user", Password: "test-password", Quota: 200, UsedQuota: 100}
			require.NoError(t, DB.Create(user).Error)
			UpdateUserUsedQuota(user.Id, -40)
			if common.BatchUpdateEnabled {
				var pending User
				require.NoError(t, DB.First(&pending, user.Id).Error)
				require.Equal(t, 100, pending.UsedQuota)
				batchUpdate()
			}
			var stored User
			require.NoError(t, DB.First(&stored, user.Id).Error)
			require.Equal(t, 60, stored.UsedQuota)
			require.Equal(t, 200, stored.Quota)
		})
	}
}
