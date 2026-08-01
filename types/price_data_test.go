package types

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGroupRatioInfoStoresOnlyGroupRatio(t *testing.T) {
	ratioType := reflect.TypeOf(GroupRatioInfo{})
	for _, removedField := range []string{"GroupSpecialRatio", "HasSpecialRatio"} {
		_, exists := ratioType.FieldByName(removedField)
		require.Falsef(t, exists, "%s must not affect direct pricing", removedField)
	}
	_, exists := ratioType.FieldByName("GroupRatio")
	require.True(t, exists)
}
