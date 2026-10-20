package controller

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 上游地址
const (
	upstreamModelsURL  = "https://basellm.github.io/llm-metadata/api/newapi/models.json"
	upstreamVendorsURL = "https://basellm.github.io/llm-metadata/api/newapi/vendors.json"
)

func normalizeLocale(locale string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(locale)) {
	case "", "zh", "zh-cn":
		return "zh", true
	case "en":
		return "en", true
	case "ja":
		return "ja", true
	default:
		return "", false
	}
}

func getUpstreamBase() string {
	return common.GetEnvOrDefaultString("SYNC_UPSTREAM_BASE", "https://basellm.github.io/llm-metadata")
}

func getUpstreamURLs(locale string) (modelsURL, vendorsURL string) {
	base := strings.TrimRight(getUpstreamBase(), "/")
	if l, ok := normalizeLocale(locale); ok && l != "" {
		return fmt.Sprintf("%s/api/i18n/%s/newapi/models.json", base, l),
			fmt.Sprintf("%s/api/i18n/%s/newapi/vendors.json", base, l)
	}
	return fmt.Sprintf("%s/api/newapi/models.json", base), fmt.Sprintf("%s/api/newapi/vendors.json", base)
}

type upstreamEnvelope[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    []T    `json:"data"`
}

type upstreamModel struct {
	Description string          `json:"description"`
	Endpoints   json.RawMessage `json:"endpoints"`
	Icon        string          `json:"icon"`
	ModelName   string          `json:"model_name"`
	NameRule    int             `json:"name_rule"`
	Status      int             `json:"status"`
	Tags        string          `json:"tags"`
	VendorName  string          `json:"vendor_name"`
}

type upstreamVendor struct {
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Name        string `json:"name"`
	Status      int    `json:"status"`
}

var (
	etagCache  = make(map[string]string)
	bodyCache  = make(map[string][]byte)
	cacheMutex sync.RWMutex
)

func newHTTPClient() *http.Client {
	timeoutSec := common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 10)
	dialer := &net.Dialer{Timeout: time.Duration(timeoutSec) * time.Second}
	transport := &http.Transport{
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   time.Duration(timeoutSec) * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: time.Duration(timeoutSec) * time.Second,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig.Clone()
	}
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			host = addr
		}
		if strings.HasSuffix(host, "github.io") {
			if conn, err := dialer.DialContext(ctx, "tcp4", addr); err == nil {
				return conn, nil
			}
			return dialer.DialContext(ctx, "tcp6", addr)
		}
		return dialer.DialContext(ctx, network, addr)
	}
	return &http.Client{Transport: transport}
}

var (
	httpClientOnce sync.Once
	httpClient     *http.Client
)

func getHTTPClient() *http.Client {
	httpClientOnce.Do(func() {
		httpClient = newHTTPClient()
	})
	return httpClient
}

func decodeMetadataBody[T any](body []byte, out *upstreamEnvelope[T]) error {
	var decoded upstreamEnvelope[T]
	if err := common.Unmarshal(body, &decoded); err != nil {
		var array []T
		if arrayErr := common.Unmarshal(body, &array); arrayErr != nil {
			return err
		}
		decoded = upstreamEnvelope[T]{Success: true, Data: array}
	} else if !decoded.Success && len(decoded.Data) == 0 && decoded.Message == "" {
		decoded.Success = true
	}
	*out = decoded
	return nil
}

func fetchJSON[T any](ctx context.Context, url string, out *upstreamEnvelope[T]) error {
	attempts := min(max(common.GetEnvOrDefault("SYNC_HTTP_RETRY", 3), 1), 8)
	maxBytes := int64(min(max(common.GetEnvOrDefault("SYNC_HTTP_MAX_MB", 10), 1), 64)) << 20
	var lastErr error
	for attempt := 0; attempt < attempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		cacheMutex.RLock()
		etag := etagCache[url]
		cacheMutex.RUnlock()
		if etag != "" {
			req.Header.Set("If-None-Match", etag)
		}
		response, err := getHTTPClient().Do(req)
		if err != nil {
			lastErr = err
		} else {
			func() {
				defer response.Body.Close()
				var body []byte
				switch response.StatusCode {
				case http.StatusOK:
					body, lastErr = io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
					if lastErr != nil {
						return
					}
					if int64(len(body)) > maxBytes {
						lastErr = errors.New("upstream metadata exceeds size limit")
						return
					}
				case http.StatusNotModified:
					cacheMutex.RLock()
					body = bodyCache[url]
					cacheMutex.RUnlock()
					if len(body) == 0 {
						lastErr = errors.New("cache miss for 304 response")
						return
					}
				default:
					lastErr = errors.New(response.Status)
					return
				}
				lastErr = decodeMetadataBody(body, out)
				if lastErr != nil {
					return
				}
				if response.StatusCode == http.StatusOK {
					cacheMutex.Lock()
					bodyCache[url] = body
					if etag := response.Header.Get("ETag"); etag != "" {
						etagCache[url] = etag
					} else {
						delete(etagCache, url)
					}
					cacheMutex.Unlock()
				}
			}()
			if lastErr == nil {
				return nil
			}
		}
		if attempt+1 == attempts {
			break
		}
		timer := time.NewTimer(200*time.Millisecond*time.Duration(1<<attempt) + time.Duration(rand.Intn(150))*time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
	return lastErr
}

type metadataSyncSource struct {
	Locale     string `json:"locale"`
	ModelsURL  string `json:"models_url"`
	VendorsURL string `json:"vendors_url"`
	Version    string `json:"version"`
}

type metadataSyncField struct {
	Field    string `json:"field"`
	Local    any    `json:"local"`
	Upstream any    `json:"upstream"`
}

type metadataSyncCandidate struct {
	ModelName      string                `json:"model_name"`
	Kind           string                `json:"kind"`
	Scope          string                `json:"scope"`
	RecordVersion  string                `json:"record_version"`
	Fields         []metadataSyncField   `json:"fields"`
	Upstream       *model.MetadataValues `json:"upstream,omitempty"`
	VendorToCreate string                `json:"vendor_to_create,omitempty"`
}

func fetchMetadataCatalog(c *gin.Context, locale string) (metadataSyncSource, map[string]model.MetadataValues, map[string]model.Vendor, error) {
	resolved, valid := normalizeLocale(locale)
	if !valid {
		return metadataSyncSource{}, nil, nil, errors.New("unsupported metadata language")
	}
	modelsURL, vendorsURL := getUpstreamURLs(resolved)
	source := metadataSyncSource{Locale: resolved, ModelsURL: modelsURL, VendorsURL: vendorsURL}
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(common.GetEnvOrDefault("SYNC_HTTP_TIMEOUT_SECONDS", 15))*time.Second)
	defer cancel()
	var modelsEnv upstreamEnvelope[upstreamModel]
	var vendorsEnv upstreamEnvelope[upstreamVendor]
	var modelsErr, vendorsErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); modelsErr = fetchJSON(ctx, modelsURL, &modelsEnv) }()
	go func() { defer wg.Done(); vendorsErr = fetchJSON(ctx, vendorsURL, &vendorsEnv) }()
	wg.Wait()
	if modelsErr != nil {
		return source, nil, nil, fmt.Errorf("fetch models (%s, %s): %w", resolved, modelsURL, modelsErr)
	}
	if vendorsErr != nil {
		return source, nil, nil, fmt.Errorf("fetch vendors (%s, %s): %w", resolved, vendorsURL, vendorsErr)
	}
	if !modelsEnv.Success || !vendorsEnv.Success {
		return source, nil, nil, errors.New("upstream metadata source reported failure")
	}
	models := make(map[string]model.MetadataValues)
	vendors := make(map[string]model.Vendor)
	for _, vendor := range vendorsEnv.Data {
		vendor.Name = strings.TrimSpace(vendor.Name)
		if vendor.Name == "" {
			continue
		}
		vendors[vendor.Name] = model.Vendor{Name: vendor.Name, Description: vendor.Description, Icon: vendor.Icon, Status: vendor.Status}
	}
	for _, item := range modelsEnv.Data {
		if strings.TrimSpace(item.ModelName) == "" {
			continue
		}
		endpoints := ""
		if len(item.Endpoints) > 0 && string(item.Endpoints) != "null" {
			if err := common.Unmarshal(item.Endpoints, &endpoints); err != nil {
				endpoints = string(item.Endpoints)
			}
		}
		values := model.MetadataValues{Description: item.Description, Icon: item.Icon, Tags: item.Tags, Vendor: strings.TrimSpace(item.VendorName), Endpoints: endpoints, NameRule: item.NameRule, Status: item.Status}
		if err := model.ValidateMetadataValues(values); err != nil {
			return source, nil, nil, fmt.Errorf("model %s: %w", item.ModelName, err)
		}
		if _, duplicate := models[item.ModelName]; duplicate {
			return source, nil, nil, fmt.Errorf("duplicate upstream model: %s", item.ModelName)
		}
		models[item.ModelName] = values
	}
	encoded, err := common.Marshal([]any{source.Locale, models, vendors})
	if err != nil {
		return source, nil, nil, err
	}
	source.Version = fmt.Sprintf("%x", sha256.Sum256(encoded))
	return source, models, vendors, nil
}

func SyncUpstreamPreview(c *gin.Context) {
	source, upstream, upstreamVendors, err := fetchMetadataCatalog(c, c.Query("locale"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	locals, vendors, err := model.GetMetadataSyncState(model.DB)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	missing, err := model.GetMissingModels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	siteNames := make(map[string]bool)
	allNames := make(map[string]bool)
	for name := range locals {
		siteNames[name] = true
		allNames[name] = true
	}
	for _, name := range missing {
		siteNames[name] = true
		allNames[name] = true
	}
	for name := range upstream {
		allNames[name] = true
	}
	names := make([]string, 0, len(allNames))
	for name := range allNames {
		names = append(names, name)
	}
	sort.Strings(names)
	vendorByID := make(map[int]*model.Vendor)
	for _, vendor := range vendors {
		vendorByID[vendor.Id] = vendor
	}
	candidates := make([]metadataSyncCandidate, 0, len(names))
	for _, name := range names {
		candidate := metadataSyncCandidate{ModelName: name, Scope: "catalog", Kind: "create", Fields: []metadataSyncField{}}
		if siteNames[name] {
			candidate.Scope = "site"
		}
		local := locals[name]
		up, found := upstream[name]
		if !found {
			candidate.Kind = "missing_upstream"
			candidates = append(candidates, candidate)
			continue
		}
		candidate.Upstream = &up
		var localVendor *model.Vendor
		if local != nil {
			localVendor = vendorByID[local.VendorID]
		}
		candidate.RecordVersion = model.MetadataRecordVersion(local, localVendor, model.FindMetadataVendor(vendors, up.Vendor))
		if local != nil && local.SyncOfficial == 0 {
			candidate.Kind = "blocked"
			candidates = append(candidates, candidate)
			continue
		}
		if up.Vendor != "" && model.FindMetadataVendor(vendors, up.Vendor) == nil {
			if _, exists := upstreamVendors[up.Vendor]; !exists {
				candidate.Kind = "missing_vendor"
				candidates = append(candidates, candidate)
				continue
			}
			candidate.VendorToCreate = up.Vendor
		}
		localValues := model.MetadataValues{}
		if local != nil {
			candidate.Kind = "update"
			localValues = model.MetadataValues{Description: local.Description, Icon: local.Icon, Tags: local.Tags, Endpoints: local.Endpoints, NameRule: local.NameRule, Status: local.Status}
			if localVendor != nil {
				localValues.Vendor = localVendor.Name
			}
		}
		localRaw, _ := common.Marshal(localValues)
		upRaw, _ := common.Marshal(up)
		var localFields, upFields map[string]any
		_ = common.Unmarshal(localRaw, &localFields)
		_ = common.Unmarshal(upRaw, &upFields)
		for _, field := range model.MetadataSyncFields {
			if local == nil || localFields[field] != upFields[field] {
				candidate.Fields = append(candidate.Fields, metadataSyncField{Field: field, Local: localFields[field], Upstream: upFields[field]})
			}
		}
		if local != nil && len(candidate.Fields) == 0 {
			candidate.Kind = "unchanged"
		}
		candidates = append(candidates, candidate)
	}
	common.ApiSuccess(c, gin.H{"source": source, "candidates": candidates})
}

func SyncUpstreamModels(c *gin.Context) {
	var request struct {
		Locale        string                        `json:"locale"`
		SourceVersion string                        `json:"source_version"`
		Selections    []model.MetadataSyncSelection `json:"selections"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || len(request.Selections) == 0 || request.SourceVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Preview and select metadata changes before applying"})
		return
	}
	source, upstream, vendors, err := fetchMetadataCatalog(c, request.Locale)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if source.Version != request.SourceVersion {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Upstream metadata changed; preview again"})
		return
	}
	updates := make([]model.MetadataSyncUpdate, 0, len(request.Selections))
	for _, selection := range request.Selections {
		values, exists := upstream[selection.ModelName]
		if !exists {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "Selected upstream model is no longer available"})
			return
		}
		updates = append(updates, model.MetadataSyncUpdate{MetadataSyncSelection: selection, Values: values})
	}
	result, err := model.ApplyMetadataSync(updates, vendors)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, model.ErrMetadataSyncConflict) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"success": false, "message": err.Error()})
		return
	}
	recordManageAudit(c, "model.metadata.sync", map[string]any{"created_models": result.CreatedModels, "updated_models": result.UpdatedModels, "created_vendors": result.CreatedVendors})
	common.ApiSuccess(c, result)
}
