package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublicContentRevalidationAndInvalidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	content := "<p>policy</p>"
	router.GET("/public", func(c *gin.Context) { serveRevalidatedJSON(c, content) })
	request := func(tag string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/public", nil)
		req.Header.Set("If-None-Match", tag)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	first := request("")
	require.Equal(t, http.StatusOK, first.Code)
	var body publicContentResponse
	require.NoError(t, common.Unmarshal(first.Body.Bytes(), &body))
	assert.Equal(t, content, body.Data)
	assert.True(t, body.Success)
	tag := first.Header().Get("ETag")
	require.NotEmpty(t, tag)
	for _, match := range []string{tag, strings.TrimPrefix(tag, "W/"), `"stale", ` + tag, "*"} {
		r := request(match)
		assert.Equal(t, http.StatusNotModified, r.Code)
		assert.Empty(t, r.Body.String())
		assert.Equal(t, "no-cache", r.Header().Get("Cache-Control"))
		assert.Equal(t, "Accept-Encoding", r.Header().Get("Vary"))
	}
	content = "edited"
	updated := request(tag)
	assert.Equal(t, http.StatusOK, updated.Code)
	assert.NotEqual(t, tag, updated.Header().Get("ETag"))
	assert.Equal(t, http.StatusOK, request(`W/"not-this-content"`).Code)
}

func TestNoticeRevalidatesCurrentOptionContent(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{"Notice": "first notice"}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		common.OptionMap = previous
	})
	router := gin.New()
	router.GET("/api/notice", GetNotice)
	request := func(tag string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/notice", nil)
		req.Header.Set("If-None-Match", tag)
		r := httptest.NewRecorder()
		router.ServeHTTP(r, req)
		return r
	}
	first := request("")
	require.Equal(t, http.StatusOK, first.Code)
	tag := first.Header().Get("ETag")
	require.NotEmpty(t, tag)
	assert.Equal(t, http.StatusNotModified, request(tag).Code)
	for _, content := range []string{"edited notice", ""} {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["Notice"] = content
		common.OptionMapRWMutex.Unlock()
		updated := request(tag)
		require.Equal(t, http.StatusOK, updated.Code)
		var body publicContentResponse
		require.NoError(t, common.Unmarshal(updated.Body.Bytes(), &body))
		assert.True(t, body.Success)
		assert.Equal(t, content, body.Data)
		assert.NotEqual(t, tag, updated.Header().Get("ETag"))
		tag = updated.Header().Get("ETag")
		assert.Equal(t, http.StatusNotModified, request(tag).Code)
	}
}
