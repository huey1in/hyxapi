package controller

import (
	"github.com/QuantumNous/new-api/setting/log_setting"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestLogTimeRangeDefaultsBoundsAndInvalidOrder(t *testing.T) {
	setting := log_setting.GetSetting()
	old := setting.MaxRangeDays
	setting.MaxRangeDays = 7
	t.Cleanup(func() { setting.MaxRangeDays = old })
	end := time.Now().Unix() - 100
	start, err := limitLogTimeRange(0, end)
	require.NoError(t, err)
	require.Equal(t, end-7*86400, start)
	_, err = limitLogTimeRange(end-7*86400, end)
	require.NoError(t, err)
	_, err = limitLogTimeRange(end-7*86400-1, end)
	require.Error(t, err)
	_, err = limitLogTimeRange(end+1, end)
	require.Error(t, err)
	_, err = limitLogTimeRange(-1, end)
	require.Error(t, err)
	_, err = limitLogTimeRange(time.Now().Unix()+86400, time.Now().Unix()+2*86400)
	require.Error(t, err)
}
