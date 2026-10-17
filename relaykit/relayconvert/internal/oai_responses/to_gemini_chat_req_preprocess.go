package oairesponses

import (
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

func PrepareOpenAIResponsesRequest(request dto.OpenAIResponsesRequest) (dto.OpenAIResponsesRequest, error) {
	tools, err := filterGeminiResponsesTools(request.Tools)
	if err != nil {
		return request, err
	}
	request.Tools = tools

	return request, nil
}

func filterGeminiResponsesTools(raw []byte) ([]byte, error) {
	if !geminiRawJSONPresent(raw) || kitutil.GetJsonType(raw) != "array" {
		return raw, nil
	}

	var tools []map[string]any
	if err := kitutil.Unmarshal(raw, &tools); err != nil {
		return nil, err
	}

	filtered := make([]map[string]any, 0, len(tools))
	for _, tool := range tools {
		if strings.TrimSpace(kitutil.Interface2String(tool["type"])) != "function" {
			continue
		}
		filtered = append(filtered, tool)
	}
	if len(filtered) == 0 {
		return nil, nil
	}
	return kitutil.Marshal(filtered)
}

func geminiRawJSONPresent(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	return kitutil.GetJsonType(raw) != "null"
}
