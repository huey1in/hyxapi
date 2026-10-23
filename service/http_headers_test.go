package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUpstreamResponseHeadersPreserveLocalTracing(t *testing.T) {
	for _, upstreamIDHeader := range []string{common.RequestIdKey, "X-Oneapi-Request-Id"} {
		t.Run(upstreamIDHeader, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set(common.RequestIdKey, "local-request")
			recorder.Header().Set(common.RequestIdKey, "local-request")
			upstream := &http.Response{StatusCode: http.StatusOK, Header: http.Header{}}
			upstream.Header.Set(upstreamIDHeader, "upstream-request")
			for _, name := range []string{"X-New-Api-Version", "X-New-Api-Other-Ratios", "X-Oneapi-Version", "Server", "X-Powered-By", "X-Generator"} {
				upstream.Header.Set(name, "upstream-implementation")
			}
			upstream.Header.Set("Content-Type", "application/json")
			upstream.Header.Set("Retry-After", "30")
			upstream.Header.Set("Content-Length", "999")
			body := []byte(`{"ok":true}`)

			IOCopyBytesGracefully(ctx, upstream, body)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Equal(t, body, recorder.Body.Bytes())
			require.Equal(t, "local-request", recorder.Header().Get(common.RequestIdKey))
			require.Equal(t, "upstream-request", ctx.GetString(common.UpstreamRequestIdKey))
			require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
			require.Equal(t, "30", recorder.Header().Get("Retry-After"))
			require.Equal(t, "11", recorder.Header().Get("Content-Length"))
			for _, name := range []string{"X-New-Api-Version", "X-New-Api-Other-Ratios", "X-Oneapi-Version", "X-Oneapi-Request-Id", "Server", "X-Powered-By", "X-Generator"} {
				require.Empty(t, recorder.Header().Get(name), name)
			}
		})
	}
}

func TestUpstreamImplementationHeaderFilterIsCaseInsensitive(t *testing.T) {
	for _, header := range []string{"x-new-api-version", "X-NEW-API-OTHER-RATIOS", "x-oneapi-version", "sErVeR", "X-POWERED-BY", "x-generator", "content-length"} {
		require.False(t, ShouldCopyUpstreamHeader(nil, header, []string{"value"}), header)
	}
	require.False(t, ShouldCopyUpstreamHeader(nil, common.RequestIdKey, nil))
	require.True(t, ShouldCopyUpstreamHeader(nil, "Content-Type", []string{"text/event-stream"}))
}
