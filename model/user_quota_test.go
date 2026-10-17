package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpdateUserUsedQuotaAdjustsOnlyUsedQuota(t *testing.T) {
	truncateTables(t)
	user := &User{
		Username:     "used-quota-delta-user",
		Password:     "test-password",
		UsedQuota:    100,
		RequestCount: 7,
	}
	require.NoError(t, DB.Create(user).Error)

	updateUserUsedQuota(user.Id, -40)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	require.Equal(t, 60, stored.UsedQuota)
	require.Equal(t, 7, stored.RequestCount)
}
