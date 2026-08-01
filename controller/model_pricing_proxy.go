package controller

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

type proxyResolver func(*http.Request) (*url.URL, error)

func parseWindowsProxyServer(proxyServer, scheme string) string {
	proxyServer = strings.TrimSpace(proxyServer)
	if proxyServer == "" {
		return ""
	}
	selected := ""
	if strings.Contains(proxyServer, "=") {
		fallback := ""
		for _, entry := range strings.Split(proxyServer, ";") {
			key, value, ok := strings.Cut(strings.TrimSpace(entry), "=")
			if !ok || strings.TrimSpace(value) == "" {
				continue
			}
			switch strings.ToLower(strings.TrimSpace(key)) {
			case scheme:
				selected = strings.TrimSpace(value)
			case "http":
				fallback = strings.TrimSpace(value)
			}
		}
		if selected == "" {
			selected = fallback
		}
	} else {
		selected = proxyServer
	}
	if selected != "" && !strings.Contains(selected, "://") {
		selected = "http://" + selected
	}
	return selected
}

func selectModelPricingProxy(request *http.Request, environment proxyResolver, windowsProxy string) (*url.URL, error) {
	if environment != nil {
		proxyURL, err := environment(request)
		if proxyURL != nil || err != nil {
			return proxyURL, err
		}
	}
	fallback := parseWindowsProxyServer(windowsProxy, request.URL.Scheme)
	if fallback == "" {
		return nil, nil
	}
	return url.Parse(fallback)
}

func newModelPricingSyncHTTPClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	windowsProxy := getWindowsSystemProxy()
	transport.Proxy = func(request *http.Request) (*url.URL, error) {
		return selectModelPricingProxy(request, http.ProxyFromEnvironment, windowsProxy)
	}
	return &http.Client{Transport: transport, Timeout: timeout}
}
