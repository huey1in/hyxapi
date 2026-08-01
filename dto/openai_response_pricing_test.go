package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInputTokenDetailsUnmarshalsCachedTokenDetails(t *testing.T) {
	var details InputTokenDetails
	err := json.Unmarshal([]byte(`{
		"cached_tokens": 300,
		"cached_tokens_details": {
			"text_tokens": 100,
			"audio_tokens": 150,
			"image_tokens": 50
		}
	}`), &details)

	require.NoError(t, err)
	require.Equal(t, 100, details.CachedTokensDetails.TextTokens)
	require.Equal(t, 150, details.CachedTokensDetails.AudioTokens)
	require.Equal(t, 50, details.CachedTokensDetails.ImageTokens)
}
