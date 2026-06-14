package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// geoBlockedPageTemplate 动态封锁页模板。
// 占位符: %[1]s 语言, %[2]s 标题, %[3]s 主文案, %[4]s 副文案(另一语言),
// %[5]s IP标签, %[6]s IP, %[7]s 地区标签, %[8]s 地区, %[9]s 支持标签,
// %[10]s 参考标签, %[11]s RayID, %[12]s 时间标签, %[13]s 时间
const geoBlockedPageTemplate = `<!DOCTYPE html>
<html lang="%[1]s">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>Routify — Service Not Available</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%%; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Helvetica, Arial, sans-serif;
            background: #fffdf7;
            color: #1a1a1a;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px; }
        .content { width: 100%%; max-width: 520px; }
        .brand {
            font-size: 13px; font-weight: 600; letter-spacing: 0.06em;
            text-transform: uppercase; color: #1a1a1a; margin-bottom: 56px;
        }
        .code { font-size: 13px; font-weight: 500; color: #ababab; letter-spacing: 0.04em; margin-bottom: 16px; }
        h1 { font-size: 28px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.3; color: #1a1a1a; margin-bottom: 20px; }
        .lead { font-size: 15px; line-height: 1.7; color: #525252; margin-bottom: 12px; }
        .lead-alt { font-size: 14px; line-height: 1.7; color: #8a8a8a; margin-bottom: 48px; }
        .meta { border-top: 1px solid #e8e6df; padding-top: 24px; }
        .meta-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; font-size: 13px; gap: 24px; }
        .meta-label { color: #ababab; white-space: nowrap; }
        .meta-value { color: #525252; text-align: right; word-break: break-all; font-variant-numeric: tabular-nums; }
        .meta-value.mono { font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace; font-size: 12.5px; }
        .meta-value a { color: #525252; text-decoration: none; border-bottom: 1px solid #d8d5cc; padding-bottom: 1px; }
        .meta-value a:hover { color: #1a1a1a; border-bottom-color: #1a1a1a; }
        footer { padding: 32px 24px; text-align: center; font-size: 12px; color: #c0beb6; }
        @media (max-width: 480px) {
            .brand { margin-bottom: 40px; }
            h1 { font-size: 23px; }
            .lead-alt { margin-bottom: 36px; }
        }
    </style>
</head>
<body>
    <main>
        <div class="content">
            <div class="brand">Routify</div>
            <div class="code">403 &middot; REGION_NOT_SUPPORTED</div>
            <h1>%[2]s</h1>
            <p class="lead">%[3]s</p>
            <p class="lead-alt">%[4]s</p>
            <div class="meta">
                <div class="meta-row">
                    <span class="meta-label">%[5]s</span>
                    <span class="meta-value mono">%[6]s</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">%[7]s</span>
                    <span class="meta-value">%[8]s</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">%[9]s</span>
                    <span class="meta-value"><a href="mailto:1in@routify.space">1in@routify.space</a></span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">%[10]s</span>
                    <span class="meta-value mono">%[11]s</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">%[12]s</span>
                    <span class="meta-value mono">%[13]s</span>
                </div>
            </div>
        </div>
    </main>
    <footer>&copy; Routify. All rights reserved.</footer>
</body>
</html>`

// countryNames 常见国家/地区代码的双语名称
var countryNames = map[string][2]string{ // code -> [zh, en]
	"CN": {"中国大陆", "Mainland China"},
	"HK": {"中国香港", "Hong Kong"},
	"MO": {"中国澳门", "Macao"},
	"TW": {"中国台湾", "Taiwan"},
	"US": {"美国", "United States"},
	"JP": {"日本", "Japan"},
	"KR": {"韩国", "South Korea"},
	"SG": {"新加坡", "Singapore"},
	"GB": {"英国", "United Kingdom"},
	"DE": {"德国", "Germany"},
	"FR": {"法国", "France"},
	"RU": {"俄罗斯", "Russia"},
	"IN": {"印度", "India"},
	"AU": {"澳大利亚", "Australia"},
	"CA": {"加拿大", "Canada"},
}

func regionDisplay(code string, zhFirst bool) string {
	if code == "" {
		code = "Unknown"
	}
	if names, ok := countryNames[strings.ToUpper(code)]; ok {
		if zhFirst {
			return fmt.Sprintf("%s (%s)", names[0], strings.ToUpper(code))
		}
		return fmt.Sprintf("%s (%s)", names[1], strings.ToUpper(code))
	}
	return strings.ToUpper(code)
}

// renderGeoBlockedPage 渲染封锁页：按浏览器 Accept-Language 选择语言（中文优先显示中文）。
// 页面展示检测到的 IP、地区、Cloudflare Ray ID 与时间，便于用户联系支持时提供凭据。
func renderGeoBlockedPage(c *gin.Context) []byte {
	ip := getClientIP(c)
	country := strings.ToUpper(c.GetHeader("CF-IPCountry"))
	rayID := c.GetHeader("CF-Ray")
	if rayID == "" {
		rayID = "-"
	}
	now := time.Now().UTC().Format("2006-01-02 15:04:05 UTC")

	zhFirst := strings.Contains(strings.ToLower(c.GetHeader("Accept-Language")), "zh")

	var lang, title, lead, leadAlt, ipLabel, regionLabel, supportLabel, refLabel, timeLabel string
	zhLead := "Routify 的服务覆盖范围不包含您所在的地区。我们的全部业务运营、服务器与数据处理均位于中国大陆以外，且不向中国大陆地区的用户提供注册或使用服务。"
	enLead := "Routify is not available in your region. All of our operations, infrastructure, and data processing are located outside Mainland China, and we do not offer registration or services to users in Mainland China."

	if zhFirst {
		lang = "zh-CN"
		title = "当前地区暂不提供服务"
		lead = zhLead
		leadAlt = enLead
		ipLabel = "检测到的 IP / Detected IP"
		regionLabel = "所属地区 / Region"
		supportLabel = "联系支持 / Support"
		refLabel = "请求编号 / Ray ID"
		timeLabel = "检测时间 / Time"
	} else {
		lang = "en"
		title = "Service is not available in your region"
		lead = enLead
		leadAlt = zhLead
		ipLabel = "Detected IP / 检测到的 IP"
		regionLabel = "Region / 所属地区"
		supportLabel = "Support / 联系支持"
		refLabel = "Ray ID / 请求编号"
		timeLabel = "Time / 检测时间"
	}

	page := fmt.Sprintf(geoBlockedPageTemplate,
		lang, title, lead, leadAlt,
		ipLabel, ip,
		regionLabel, regionDisplay(country, zhFirst),
		supportLabel,
		refLabel, rayID,
		timeLabel, now,
	)
	return []byte(page)
}

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
	// 检查 Cloudflare 国家代码（最可靠）
	return c.GetHeader("CF-IPCountry") == "CN"
}

func GeoBlock() gin.HandlerFunc {
	return func(c *gin.Context) {
		// API 路径不拦截，仅限制网页访问
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/v1/") ||
			strings.HasPrefix(path, "/api/") ||
			strings.HasPrefix(path, "/mj/") ||
			strings.HasPrefix(path, "/suno/") {
			c.Next()
			return
		}
		if isChineseRequest(c) {
			c.Data(http.StatusForbidden, "text/html; charset=utf-8", renderGeoBlockedPage(c))
			c.Abort()
			return
		}
		c.Next()
	}
}
