package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

type WorkerRequest struct {
	URL     string            `json:"url"`
	Key     string            `json:"key"`
	Method  string            `json:"method,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    json.RawMessage   `json:"body,omitempty"`
}

func doWorkerRequest(req *WorkerRequest, worker system_setting.WorkerSettings) (*http.Response, error) {
	if worker.URL == "" {
		return nil, fmt.Errorf("worker not enabled")
	}
	if req == nil {
		return nil, fmt.Errorf("invalid worker request")
	}
	target, err := url.Parse(req.URL)
	if err != nil || target.Hostname() == "" || (target.Scheme != "https" && (!worker.AllowHTTP || target.Scheme != "http")) {
		return nil, fmt.Errorf("worker target requires HTTPS unless HTTP access is enabled")
	}
	if err := ValidateSSRFProtectedFetchURL(req.URL); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}
	if err := system_setting.ValidateWorkerOption("WorkerUrl", worker.URL); err != nil {
		return nil, err
	}
	payload, err := common.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal worker payload: %w", err)
	}
	// A redirect must not forward the worker key or request body to another host.
	client := *GetHttpClient()
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return client.Post(strings.TrimRight(worker.URL, "/")+"/", "application/json", bytes.NewReader(payload))
}

func DoDownloadRequest(originUrl string, reason ...string) (resp *http.Response, err error) {
	worker := system_setting.WorkerSettingsSnapshot()
	if worker.URL != "" {
		return doWorkerRequest(&WorkerRequest{URL: originUrl, Key: worker.Key}, worker)
	}
	if err := ValidateSSRFProtectedFetchURL(originUrl); err != nil {
		return nil, fmt.Errorf("request reject: %v", err)
	}

	common.SysLog(fmt.Sprintf("downloading from origin: %s, reason: %s", common.MaskSensitiveInfo(originUrl), strings.Join(reason, ", ")))
	return GetSSRFProtectedHTTPClient().Get(originUrl)
}
