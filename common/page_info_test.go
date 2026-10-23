package common

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestPageQueryUsesCanonicalSizeAndBoundsOffsets(t *testing.T) {
	for _, tc := range []struct {
		query      string
		page, size int
	}{
		{"?p=2&page_size=10", 2, 10},
		{"?p=-2&page_size=-10", 1, ItemsPerPage},
		{"?p=1&page_size=1000", 1, 100},
		{"?p=1&size=10&ps=5", 1, ItemsPerPage},
	} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/"+tc.query, nil)
		page := GetPageQuery(c)
		assert.Equal(t, tc.page, page.Page)
		assert.Equal(t, tc.size, page.PageSize)
		assert.GreaterOrEqual(t, page.GetStartIdx(), 0)
	}
}
