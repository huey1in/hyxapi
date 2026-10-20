package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLogUsageBucketsRespectLocalDaysAndDST(t *testing.T) {
	location, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)
	for _, day := range []time.Time{
		time.Date(2026, 3, 8, 0, 0, 0, 0, location),
		time.Date(2026, 11, 1, 0, 0, 0, 0, location),
	} {
		t.Run(day.Format("2006-01-02"), func(t *testing.T) {
			end := day.AddDate(0, 0, 1).Unix() - 1
			trend, err := logUsageBuckets(day.Unix(), end, location)
			require.NoError(t, err)
			require.Equal(t, "hour", trend.Interval)
			require.Len(t, trend.Points, int((end+1-day.Unix())/3600))
			for index, point := range trend.Points {
				require.Equal(t, day.Unix()+int64(index)*3600, point.Timestamp)
			}
			trend, err = logUsageBuckets(day.AddDate(0, 0, -1).Unix(), day.AddDate(0, 0, 2).Unix()-1, location)
			require.NoError(t, err)
			require.Equal(t, "day", trend.Interval)
			require.Len(t, trend.Points, 3)
			for index, point := range trend.Points {
				require.Equal(t, day.AddDate(0, 0, index-1).Unix(), point.Timestamp)
			}
		})
	}
	location, err = time.LoadLocation("Asia/Kolkata")
	require.NoError(t, err)
	start := time.Date(2026, 10, 1, 9, 15, 0, 0, location)
	trend, err := logUsageBuckets(start.Unix(), start.Add(time.Hour).Unix(), location)
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 10, 1, 9, 0, 0, 0, location).Unix(), trend.Points[0].Timestamp)
}

func TestLogUsageBucketsBoundLongCustomRangesAndRejectInvalidBounds(t *testing.T) {
	for _, test := range []struct {
		start, end string
		interval   string
	}{
		{"2026-01-01", "2026-06-01", "month"},
		{"1970-01-01", "2026-10-01", "year"},
	} {
		start, err := time.Parse("2006-01-02", test.start)
		require.NoError(t, err)
		end, err := time.Parse("2006-01-02", test.end)
		require.NoError(t, err)
		trend, err := logUsageBuckets(start.Unix(), end.Unix(), time.UTC)
		require.NoError(t, err)
		require.Equal(t, test.interval, trend.Interval)
		require.LessOrEqual(t, len(trend.Points), 128)
	}
	for _, bounds := range [][2]int64{{-1, 1}, {2, 1}, {0, 253402300800}} {
		_, err := logUsageBuckets(bounds[0], bounds[1], time.UTC)
		require.Error(t, err)
	}
}
