package common

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

// ParseProxyURL validates a proxy address and removes an optional root slash.
func ParseProxyURL(rawProxyURL string) (*url.URL, error) {
	trimmedProxyURL := strings.TrimSpace(rawProxyURL)
	if trimmedProxyURL == "" {
		return nil, nil
	}

	parsedURL, err := url.Parse(trimmedProxyURL)
	if err != nil {
		return nil, fmt.Errorf("invalid proxy URL")
	}
	parsedURL.Scheme = strings.ToLower(parsedURL.Scheme)
	switch parsedURL.Scheme {
	case "http", "https", "socks5", "socks5h":
	default:
		return nil, fmt.Errorf("proxy URL must use http, https, socks5, or socks5h")
	}
	if parsedURL.Hostname() == "" {
		return nil, fmt.Errorf("proxy URL must include a host")
	}
	if portText := parsedURL.Port(); portText != "" {
		port, err := strconv.Atoi(portText)
		if err != nil || port < 1 || port > 65535 {
			return nil, fmt.Errorf("proxy URL must include a valid port")
		}
	}

	hasQuery := parsedURL.RawQuery != "" || parsedURL.ForceQuery
	hasFragment := strings.Contains(trimmedProxyURL, "#")
	escapedPath := parsedURL.EscapedPath()
	hasNonRootPath := escapedPath != "" && escapedPath != "/"
	switch {
	case hasQuery:
		return nil, fmt.Errorf("proxy URL must not include a query")
	case hasFragment:
		return nil, fmt.Errorf("proxy URL must not include a fragment")
	case hasNonRootPath:
		return nil, fmt.Errorf("proxy URL must not include a path")
	}

	parsedURL.Path = ""
	parsedURL.RawPath = ""
	parsedURL.RawQuery = ""
	parsedURL.ForceQuery = false
	parsedURL.Fragment = ""
	parsedURL.RawFragment = ""

	if (parsedURL.Scheme == "socks5" || parsedURL.Scheme == "socks5h") && parsedURL.Port() == "" {
		parsedURL.Host = net.JoinHostPort(parsedURL.Hostname(), "1080")
	}

	return parsedURL, nil
}
