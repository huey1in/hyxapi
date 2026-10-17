package common

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type failingBody struct {
	reads, closes int
	err           error
}

func (b *failingBody) Read([]byte) (int, error) { b.reads++; return 0, b.err }
func (b *failingBody) Close() error             { b.closes++; return nil }

func TestGetRequestBodyCachesReadFailure(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/", nil)
	body := &failingBody{err: errors.New("original read failure")}
	c.Request.Body, c.Request.ContentLength = body, -1
	_, first := GetRequestBody(c)
	_, second := GetRequestBody(c)
	require.ErrorIs(t, first, body.err)
	require.Same(t, first, second)
	require.Equal(t, 1, body.reads)
	require.Equal(t, 1, body.closes)
}

func TestUpstreamMaskingPreservesPublicDocumentation(t *testing.T) {
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("HTTPS_PROXY", "")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://private.example.net/v1")
	message := MaskSensitiveInfo("dial private.example.net failed; see https://platform.openai.com/docs", UpstreamAddresses(c)...)
	require.NotContains(t, message, "private.example.net")
	require.Contains(t, message, "https://platform.openai.com/docs")
	SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://api.openai.com")
	require.Empty(t, UpstreamAddresses(c))
}
