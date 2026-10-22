package openrouter

import "encoding/json"

type OpenRouterEnterpriseResponse struct {
	Data    json.RawMessage `json:"data"`
	Success bool            `json:"success"`
}
