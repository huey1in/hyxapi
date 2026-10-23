package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	return cors.New(config)
}

// CORSWithCredentials 面向浏览器、带 Cookie 的跨源请求（如独立部署的展示站调用 /api 登录）。
// 必须挂在引擎最前面（先于全局 CORS()），因为带凭证的预检不能用 "*"，要按白名单回显具体 Origin。
// 命中白名单时本中间件完整接管（含 OPTIONS 预检直接 204 返回）；未命中则放行，
// 交由后续的全局 CORS()（AllowAllOrigins）处理 relay/bearer 等非凭证场景。
// 白名单来自环境变量 BROWSER_CORS_ORIGINS（逗号分隔）；为空时整体退化为无操作。
func CORSWithCredentials() gin.HandlerFunc {
	allowed := make(map[string]bool)
	for _, o := range strings.Split(common.GetEnvOrDefaultString("BROWSER_CORS_ORIGINS", ""), ",") {
		if o = strings.TrimSpace(o); o != "" {
			allowed[o] = true
		}
	}
	if len(allowed) == 0 {
		return func(c *gin.Context) { c.Next() }
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" || !allowed[origin] {
			c.Next()
			return
		}
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Credentials", "true")
		h.Add("Vary", "Origin")
		if c.Request.Method == http.MethodOptions {
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, Cache-Control, Accept-Language")
			h.Set("Access-Control-Max-Age", "86400")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
