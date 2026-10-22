package ollama

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type ManagementClient struct {
	BaseURL string
	APIKey  string
	Client  *http.Client
}

func (client ManagementClient) request(ctx context.Context, method, path string, payload any) (*http.Response, error) {
	base := strings.TrimRight(strings.TrimSpace(client.BaseURL), "/")
	if base == "" {
		return nil, fmt.Errorf("Ollama base URL is empty")
	}
	var body []byte
	var err error
	if payload != nil {
		body, err = common.Marshal(payload)
		if err != nil {
			return nil, err
		}
	}
	request, err := http.NewRequestWithContext(ctx, method, base+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if key := strings.TrimSpace(client.APIKey); key != "" && key != "EMPTY" {
		request.Header.Set("Authorization", "Bearer "+key)
	}
	httpClient := http.Client{}
	if client.Client != nil {
		httpClient = *client.Client
	}
	// Each operation owns its deadline; a shared short client timeout must not
	// interrupt a large model download.
	httpClient.Timeout = 0
	httpClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, err := httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		response.Body.Close()
		return nil, fmt.Errorf("Ollama returned HTTP %d", response.StatusCode)
	}
	return response, nil
}

func readManagementBody(body io.Reader) ([]byte, error) {
	const maximum = 2 << 20
	data, err := io.ReadAll(io.LimitReader(body, maximum+1))
	if err == nil && len(data) > maximum {
		err = fmt.Errorf("Ollama response exceeds size limit")
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (client ManagementClient) Models(ctx context.Context) ([]OllamaModel, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	response, err := client.request(ctx, http.MethodGet, "/api/tags", nil)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, err := readManagementBody(response.Body)
	if err != nil {
		return nil, err
	}
	var result struct {
		Models *[]OllamaModel `json:"models"`
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Models == nil {
		return nil, fmt.Errorf("Ollama response is missing models")
	}
	return *result.Models, nil
}

func (client ManagementClient) Version(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	response, err := client.request(ctx, http.MethodGet, "/api/version", nil)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	body, err := readManagementBody(response.Body)
	if err != nil {
		return "", err
	}
	var result struct {
		Version string `json:"version"`
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return "", err
	}
	if strings.TrimSpace(result.Version) == "" {
		return "", fmt.Errorf("no Ollama version information returned")
	}
	return result.Version, nil
}

func (client ManagementClient) Delete(ctx context.Context, model string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	response, err := client.request(ctx, http.MethodDelete, "/api/delete", OllamaDeleteRequest{Name: strings.TrimSpace(model)})
	if err != nil {
		return err
	}
	defer response.Body.Close()
	_, err = readManagementBody(response.Body)
	return err
}

func (client ManagementClient) Pull(ctx context.Context, model string, stream bool, progress func(OllamaPullResponse)) error {
	ctx, cancel := context.WithTimeout(ctx, time.Hour)
	defer cancel()
	response, err := client.request(ctx, http.MethodPost, "/api/pull", struct {
		Name   string `json:"name"`
		Stream bool   `json:"stream"`
	}{strings.TrimSpace(model), stream})
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if !stream {
		body, err := readManagementBody(response.Body)
		if err != nil {
			return err
		}
		var result struct {
			Status string `json:"status"`
			Error  string `json:"error"`
		}
		if err := common.Unmarshal(body, &result); err != nil {
			return err
		}
		if result.Error != "" {
			return fmt.Errorf("Ollama pull failed: %s", result.Error)
		}
		if !strings.EqualFold(result.Status, "success") {
			return fmt.Errorf("model pull did not complete: no success status received")
		}
		return nil
	}
	scanner := bufio.NewScanner(response.Body)
	scanner.Buffer(make([]byte, 4096), 2<<20)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		var result struct {
			OllamaPullResponse
			Error string `json:"error"`
		}
		if err := common.Unmarshal(line, &result); err != nil {
			return fmt.Errorf("invalid Ollama pull progress: %w", err)
		}
		if result.Error != "" {
			return fmt.Errorf("Ollama pull failed: %s", result.Error)
		}
		if strings.EqualFold(result.Status, "error") {
			return fmt.Errorf("Ollama pull failed")
		}
		if progress != nil {
			progress(result.OllamaPullResponse)
		}
		if strings.EqualFold(result.Status, "success") {
			return nil
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return fmt.Errorf("model pull did not complete: no success status received")
}
