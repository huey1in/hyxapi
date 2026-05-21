package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const geoBlockedHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>服务不可用 - Service Unavailable</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Kefaiii, Gilroy, Noto Sans SC, -apple-system, sans-serif;
            background: #FFFDF7;
            color: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px 16px;
        }
        .container {
            width: 100%;
            max-width: 740px;
            margin: 0 auto;
        }
        .card {
            background: #FFFDF7;
            border: 1px solid #e9e9e9;
            border-radius: 26px;
            padding: 48px 40px;
            text-align: center;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            color: #000;
            margin-bottom: 12px;
        }
        .subtitle {
            font-size: 16px;
            color: #666;
            margin-bottom: 40px;
        }
        .notice-box {
            background: #F2F0E9;
            border-radius: 16px;
            padding: 24px;
            text-align: left;
            margin-bottom: 28px;
        }
        .notice-box h2 {
            font-size: 16px;
            font-weight: 600;
            color: #000;
            margin-bottom: 16px;
        }
        .notice-box p {
            font-size: 14px;
            line-height: 1.6;
            color: #666;
            margin-bottom: 12px;
        }
        .notice-box p strong {
            color: #000;
            font-weight: 600;
        }
        .notice-box ul {
            list-style: none;
            padding-left: 0;
            margin-top: 12px;
        }
        .notice-box li {
            font-size: 14px;
            line-height: 1.8;
            color: #666;
            padding-left: 16px;
            position: relative;
        }
        .notice-box li:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #999;
        }
        .divider {
            height: 1px;
            background: #eeeeee;
            margin: 28px 0;
        }
        .footer {
            font-size: 13px;
            color: #999;
            line-height: 1.6;
        }
        .footer a {
            color: #666;
            text-decoration: none;
            transition: color 0.2s;
        }
        .footer a:hover {
            color: #000;
        }
        @media (max-width: 640px) {
            .card {
                padding: 32px 24px;
            }
            h1 {
                font-size: 20px;
            }
            .subtitle {
                font-size: 14px;
            }
            .notice-box {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>服务不可用</h1>
            <p class="subtitle">Service Unavailable</p>

            <div class="notice-box">
                <h2>重要通知：服务范围限制</h2>
                <p><strong>RoutifyAPI 不在中国大陆提供服务。</strong></p>
                <ul>
                    <li>本服务仅面向中国大陆以外的地区和用户</li>
                    <li>中国大陆用户不得注册或使用 RoutifyAPI 服务</li>
                    <li>我们的服务器和数据中心不位于中国大陆</li>
                    <li>所有业务运营和数据处理均在中国大陆以外进行</li>
                </ul>
            </div>

            <div class="notice-box">
                <h2>Important Notice: Service Coverage</h2>
                <p><strong>RoutifyAPI does not provide services in Mainland China.</strong></p>
                <ul>
                    <li>This service is only available to regions and users outside Mainland China</li>
                    <li>Users in Mainland China are not permitted to register or use RoutifyAPI services</li>
                    <li>Our servers and data centers are not located in Mainland China</li>
                    <li>All business operations and data processing are conducted outside Mainland China</li>
                </ul>
            </div>

            <div class="divider"></div>

            <div class="footer">
                <p>如有疑问，请联系：<a href="mailto:1in@routify.space">1in@routify.space</a></p>
                <p>For inquiries, please contact: <a href="mailto:1in@routify.space">1in@routify.space</a></p>
            </div>
        </div>
    </div>
</body>
</html>`

func getClientIP(c *gin.Context) string {
	// 优先从 X-Forwarded-For 获取
	xff := c.GetHeader("X-Forwarded-For")
	if xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// 其次从 X-Real-IP 获取
	xri := c.GetHeader("X-Real-IP")
	if xri != "" {
		return strings.TrimSpace(xri)
	}

	// 其次从 CF-Connecting-IP 获取（Cloudflare）
	cfIP := c.GetHeader("CF-Connecting-IP")
	if cfIP != "" {
		return strings.TrimSpace(cfIP)
	}

	// 最后使用 RemoteAddr
	ip := c.ClientIP()
	return ip
}

func isChineseRequest(c *gin.Context) bool {
	// 检查 Cloudflare 国家代码
	cfCountry := c.GetHeader("CF-IPCountry")
	if cfCountry == "CN" {
		return true
	}

	// 检查 Accept-Language 头
	acceptLang := c.GetHeader("Accept-Language")
	if strings.Contains(strings.ToLower(acceptLang), "zh-cn") {
		// 仅语言不足以判断，需要结合其他因素
	}

	// 可以添加更多检测逻辑，如 IP 段检测
	// 但最可靠的是使用 Cloudflare 的 CF-IPCountry 头

	return false
}

func GeoBlock() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// 只对网页路由进行地理封锁，不限制 API 调用
		// API 路由通常以 /v1 或 /api 开头
		if strings.HasPrefix(path, "/v1/") ||
		   strings.HasPrefix(path, "/api/") ||
		   strings.HasPrefix(path, "/mj/") ||
		   strings.HasPrefix(path, "/suno/") {
			// API 路由，不进行地理封锁
			c.Next()
			return
		}

		// 检查是否为中国请求
		if isChineseRequest(c) {
			c.Data(http.StatusForbidden, "text/html; charset=utf-8", []byte(geoBlockedHTML))
			c.Abort()
			return
		}

		c.Next()
	}
}


