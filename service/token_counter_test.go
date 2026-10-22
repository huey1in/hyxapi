package service

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRequestImageEstimationUsesModelAndDetail(t *testing.T) {
	oldCount, oldMedia, oldNonStream := constant.CountToken, constant.GetMediaToken, constant.GetMediaTokenNotStream
	t.Cleanup(func() {
		constant.CountToken, constant.GetMediaToken, constant.GetMediaTokenNotStream = oldCount, oldMedia, oldNonStream
	})
	constant.CountToken, constant.GetMediaToken, constant.GetMediaTokenNotStream = true, true, true
	var encoded bytes.Buffer
	require.NoError(t, png.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 1000, 1000))))
	for _, tc := range []struct {
		model, detail string
		want          int
	}{
		{"gpt-5.6-luna", "original", 1229},
		{"gpt-5.6-luna", "high", 692},
		{"claude-haiku-4-5", "", 1300},
		{"claude-sonnet-5", "", 1299},
		{"gemini-3.7-flash", "MEDIA_RESOLUTION_LOW", 280},
	} {
		t.Run(tc.model+"/"+tc.detail, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			common.SetContextKey(c, constant.ContextKeyOriginalModel, tc.model)
			file := &types.FileMeta{
				FileType: types.FileTypeImage,
				Source:   types.NewBase64FileSource(base64.StdEncoding.EncodeToString(encoded.Bytes()), "image/png"),
				Detail:   tc.detail,
			}
			defer CleanupFileSources(c)
			got, err := EstimateRequestToken(c, &types.TokenCountMeta{Files: []*types.FileMeta{file}}, &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude})
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
			require.Equal(t, tc.want, common.GetContextKeyInt(c, constant.ContextKeyPromptTokens))
		})
	}
}

func TestRequestCountingRemainsAvailableWhenEstimationDisabled(t *testing.T) {
	oldCount := constant.CountToken
	t.Cleanup(func() { constant.CountToken = oldCount })
	constant.CountToken = false
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt-5.6-sol")
	meta := &types.TokenCountMeta{TokenType: types.TokenTypeTokenizer, CombineText: "hello"}
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	estimate, err := EstimateRequestToken(c, meta, info)
	require.NoError(t, err)
	require.Zero(t, estimate)
	count, err := CountRequestToken(c, meta, info)
	require.NoError(t, err)
	require.Equal(t, 1, count)
}

func TestImageCountingAvoidsNetworkWhenMeasurementDisabled(t *testing.T) {
	oldMedia := constant.GetMediaToken
	t.Cleanup(func() { constant.GetMediaToken = oldMedia })
	constant.GetMediaToken = false
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	file := &types.FileMeta{
		FileType: types.FileTypeImage,
		Source:   types.NewURLFileSource("http://127.0.0.1:1/unreachable.png"),
		Detail:   "original",
	}
	got, err := getImageToken(c, file, "gpt-5.6-sol", true)
	require.NoError(t, err)
	require.Equal(t, 1229, got)
}
