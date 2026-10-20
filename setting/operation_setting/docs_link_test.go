package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeDocsLink(t *testing.T) {
	for _, value := range []string{"javascript:alert(1)", "//example.test", "https:example.test", "https://user:password@example.test/", "https://example.test/\nscript", "data:text/html,test"} {
		_, err := NormalizeDocsLink(value)
		require.Error(t, err)
	}
	value, err := NormalizeDocsLink(" HTTPS://example.test/help?language=en#api ")
	require.NoError(t, err)
	require.Equal(t, "https://example.test/help?language=en#api", value)
	value, err = NormalizeDocsLink(" ")
	require.NoError(t, err)
	require.Empty(t, value)
}
