package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte, pluginHandlers ...gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(buildFS, "web/dist")
	compress := gzip.Gzip(gzip.DefaultCompression)
	router.Use(func(c *gin.Context) {
		if !frontendFS.Exists("/", c.Request.URL.Path) {
			compress(c)
		}
	})
	router.Use(middleware.GlobalWebRateLimit(frontendFS))
	router.Use(middleware.Cache())
	router.Static("/uploads", "./uploads")
	router.Use(middleware.ServeFrontendFiles(frontendFS))
	router.NoRoute(append(pluginHandlers, func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			c.Header("Cache-Control", "private, no-store")
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	})...)
}
