package oairesponses

import (
	"fmt"
	"slices"
	"strings"

	"context"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

func OpenAIResponsesRequestToGeminiChat(c context.Context, req *dto.OpenAIResponsesRequest, info convmeta.Meta) (*dto.GeminiChatRequest, error) {
	opts := convmeta.OptionsOf(info)
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model is required")
	}
	if err := ValidateRequestChatUnsupportedFields(req); err != nil {
		return nil, err
	}

	geminiRequest := &dto.GeminiChatRequest{
		GenerationConfig: dto.GeminiChatGenerationConfig{
			Temperature: req.Temperature,
		},
	}
	if req.TopP != nil && *req.TopP > 0 {
		geminiRequest.GenerationConfig.TopP = kitutil.GetPointer(*req.TopP)
	}
	if req.MaxOutputTokens != nil && *req.MaxOutputTokens > 0 {
		geminiRequest.GenerationConfig.MaxOutputTokens = kitutil.GetPointer(*req.MaxOutputTokens)
	}

	upstreamModelName := req.Model
	if modelName := convmeta.UpstreamModelName(info); modelName != "" {
		upstreamModelName = modelName
	}
	if opts.Gemini.SupportsImagineModel(upstreamModelName) {
		geminiRequest.GenerationConfig.ResponseModalities = []string{"TEXT", "IMAGE"}
	}
	if err := applyResponsesTextToGemini(c, req.Text, geminiRequest, opts.Gemini.SupportsJSONSchemaModel(upstreamModelName)); err != nil {
		return nil, err
	}
	sharedgemini.ApplyThinkingConfig(geminiRequest, info, dto.GeneralOpenAIRequest{
		Model:               req.Model,
		MaxCompletionTokens: req.MaxOutputTokens,
		ReasoningEffort:     ReasoningEffort(req),
	})

	var safetySettings []dto.GeminiChatSafetySettings
	for _, category := range sharedgemini.SafetySettingCategories {
		threshold := opts.Gemini.SafetySettingFor(category)
		if threshold == "" {
			continue
		}
		safetySettings = append(safetySettings, dto.GeminiChatSafetySettings{
			Category:  category,
			Threshold: threshold,
		})
	}
	if len(safetySettings) > 0 {
		geminiRequest.SafetySettings = safetySettings
	}

	functions, err := RequestFunctionDeclarations(req.Tools)
	if err != nil {
		return nil, err
	}
	for i := range functions {
		field, value, _ := sharedgemini.FunctionParameters(functions[i].Parameters, opts.Gemini.SupportsJSONSchemaModel(upstreamModelName))
		functions[i].Parameters = nil
		if field == "parametersJsonSchema" {
			functions[i].ParametersJsonSchema = value
		} else {
			functions[i].Parameters = value
		}
	}
	if len(functions) > 0 {
		geminiRequest.SetTools([]dto.GeminiChatTool{
			{FunctionDeclarations: functions},
		})
	}

	toolChoice, err := RequestToolChoiceToChat(req.ToolChoice)
	if err != nil {
		return nil, err
	}
	if toolChoice != nil {
		geminiRequest.ToolConfig = sharedgemini.OpenAIToolChoiceToConfig(toolChoice)
	}

	systemTexts := make([]string, 0)
	if RawJSONPresent(req.Instructions) {
		instructions, err := JSONString(req.Instructions)
		if err != nil {
			return nil, fmt.Errorf("invalid instructions: %w", err)
		}
		if strings.TrimSpace(instructions) != "" {
			systemTexts = append(systemTexts, instructions)
		}
	}

	inputItems, err := InputItems(req.Input)
	if err != nil {
		return nil, err
	}
	callNames := make(map[string]string)
	modelID := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(upstreamModelName)), "models/")
	toolMediaInFunctionResponse := !strings.HasPrefix(modelID, "gemini-1.") && !strings.HasPrefix(modelID, "gemini-2.")
	for _, item := range inputItems {
		itemType := strings.TrimSpace(kitutil.Interface2String(item["type"]))
		switch itemType {
		case ResponsesInputTypeFunctionCall, ResponsesInputTypeCustomToolCall:
			part, callID, err := responsesFunctionCallItemToGeminiPart(item, itemType)
			if err != nil {
				return nil, err
			}
			sharedgemini.AttachFunctionCallThoughtSignature(opts, &part)
			if callID != "" {
				callNames[callID] = part.FunctionCall.FunctionName
			}
			appendGeminiContentPart(geminiRequest, "model", part)
		case ResponsesInputTypeFunctionCallOutput, ResponsesInputTypeCustomToolOutput:
			part, media, err := responsesFunctionOutputItemToGeminiPart(c, item, callNames, toolMediaInFunctionResponse)
			if err != nil {
				return nil, err
			}
			appendGeminiContentPart(geminiRequest, "user", part)
			turn := &geminiRequest.Contents[len(geminiRequest.Contents)-1]
			turn.Parts = append(turn.Parts, media...)
		default:
			role := responsesGeminiRole(item)
			parts, err := responsesInputContentToGeminiParts(c, item["content"])
			if err != nil {
				return nil, err
			}
			if role == "system" {
				for _, part := range parts {
					if part.Text != "" {
						systemTexts = append(systemTexts, part.Text)
					}
				}
				continue
			}
			if len(parts) > 0 {
				geminiRequest.Contents = append(geminiRequest.Contents, dto.GeminiChatContent{
					Role:  role,
					Parts: parts,
				})
			}
		}
	}

	if len(systemTexts) > 0 {
		geminiRequest.SystemInstructions = &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{{Text: strings.Join(systemTexts, "\n")}},
		}
	}

	return geminiRequest, nil
}

func applyResponsesTextToGemini(c context.Context, raw []byte, geminiRequest *dto.GeminiChatRequest, jsonSchema bool) error {
	responseFormat, err := RequestTextToChatResponseFormat(raw)
	if err != nil {
		return err
	}
	if responseFormat == nil || (responseFormat.Type != "json_schema" && responseFormat.Type != "json_object") {
		return nil
	}

	geminiRequest.GenerationConfig.ResponseMimeType = "application/json"
	if len(responseFormat.JsonSchema) == 0 {
		return nil
	}

	sharedgemini.ApplyResponseSchema(c, &geminiRequest.GenerationConfig, responseFormat.JsonSchema, "text.format", jsonSchema)
	return nil
}

func responsesInputContentToGeminiParts(c context.Context, content any) ([]dto.GeminiPart, error) {
	contentParts, err := ContentParts(content)
	if err != nil {
		return nil, err
	}

	parts := make([]dto.GeminiPart, 0, len(contentParts))
	for _, contentPart := range contentParts {
		nextParts, err := responsesContentPartToGeminiParts(c, contentPart)
		if err != nil {
			return nil, err
		}
		parts = append(parts, nextParts...)
	}
	return parts, nil
}

func responsesContentPartToGeminiParts(c context.Context, part map[string]any) ([]dto.GeminiPart, error) {
	partType := strings.TrimSpace(kitutil.Interface2String(part["type"]))
	switch partType {
	case "input_text", "output_text", "text":
		text := kitutil.Interface2String(part["text"])
		if text == "" {
			return nil, nil
		}
		return []dto.GeminiPart{{Text: text}}, nil
	case "input_image", "input_file", "input_audio", "input_video":
		source := ContentPartToFileSource(part)
		if source == nil {
			return nil, nil
		}
		base64Data, mimeType, err := relaymedia.ResolveBase64Data(c, source, "formatting Responses input for Gemini")
		if err != nil {
			return nil, fmt.Errorf("get file data from '%s' failed: %w", source.GetIdentifier(), err)
		}
		if !sharedgemini.IsSupportedMimeType(mimeType) {
			return nil, fmt.Errorf("mime type is not supported by Gemini: '%s', url: '%s', supported types are: %v", mimeType, source.GetIdentifier(), sharedgemini.SupportedMimeTypesList())
		}
		return []dto.GeminiPart{
			{
				InlineData: &dto.GeminiInlineData{
					MimeType: mimeType,
					Data:     base64Data,
				},
			},
		}, nil
	default:
		return nil, nil
	}
}

func responsesFunctionCallItemToGeminiPart(item map[string]any, itemType string) (dto.GeminiPart, string, error) {
	name := strings.TrimSpace(kitutil.Interface2String(item["name"]))
	if name == "" {
		return dto.GeminiPart{}, "", fmt.Errorf("function_call item is missing name")
	}
	callID := CallID(item)
	arguments := ObjectValue(item["arguments"], "arguments")
	if itemType == ResponsesInputTypeCustomToolCall {
		arguments = map[string]any{"input": responsesArgumentsString(item["input"])}
	}
	return dto.GeminiPart{
		FunctionCall: &dto.FunctionCall{
			ID:           callID,
			FunctionName: name,
			Arguments:    arguments,
		},
	}, callID, nil
}

func responsesFunctionOutputItemToGeminiPart(c context.Context, item map[string]any, callNames map[string]string, mediaInParts bool) (dto.GeminiPart, []dto.GeminiPart, error) {
	callID := CallID(item)
	name := strings.TrimSpace(kitutil.Interface2String(item["name"]))
	if name == "" {
		name = callNames[callID]
	}
	output, media, err := responsesToolOutputToGemini(c, item["output"], mediaInParts)
	if err != nil {
		return dto.GeminiPart{}, nil, err
	}
	response := &dto.GeminiFunctionResponse{Name: name, Response: output}
	if mediaInParts && len(media) > 0 {
		response.Parts, err = kitutil.Marshal(media)
		if err != nil {
			return dto.GeminiPart{}, nil, fmt.Errorf("marshal function response parts: %w", err)
		}
		media = nil
	}
	if callID != "" {
		response.ID, err = kitutil.Marshal(callID)
		if err != nil {
			return dto.GeminiPart{}, nil, fmt.Errorf("marshal function response ID: %w", err)
		}
	}
	return dto.GeminiPart{FunctionResponse: response}, media, nil
}

// Content-part arrays must resolve their media rather than tokenize base64 as
// text. Unsupported media returns an error because this fork has no lossy
// conversion diagnostic policy. Other payload shapes retain their JSON map.
func responsesToolOutputToGemini(c context.Context, value any, mediaInParts bool) (map[string]any, []dto.GeminiPart, error) {
	rawParts, ok := value.([]any)
	if !ok || len(rawParts) == 0 {
		return GeminiResponseMap(value), nil, nil
	}
	parts := make([]map[string]any, 0, len(rawParts))
	for _, raw := range rawParts {
		part, ok := raw.(map[string]any)
		if !ok {
			return GeminiResponseMap(value), nil, nil
		}
		switch strings.TrimSpace(kitutil.Interface2String(part["type"])) {
		case "input_text", "output_text", "text", "input_image", "input_file", "input_audio", "input_video":
		default:
			return GeminiResponseMap(value), nil, nil
		}
		parts = append(parts, part)
	}
	var texts []string
	var media []dto.GeminiPart
	for _, part := range parts {
		partType := strings.TrimSpace(kitutil.Interface2String(part["type"]))
		switch partType {
		case "input_text", "output_text", "text":
			if text := kitutil.Interface2String(part["text"]); text != "" {
				texts = append(texts, text)
			}
			continue
		}
		source := ContentPartToFileSource(part)
		if source == nil {
			return nil, nil, fmt.Errorf("Responses tool output %s is missing media data", partType)
		}
		data, mimeType, err := relaymedia.ResolveBase64Data(c, source, "formatting Responses tool output for Gemini")
		if err != nil {
			return nil, nil, fmt.Errorf("load Responses tool output media: %w", err)
		}
		topLevelType, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(mimeType)), "/")
		if !sharedgemini.IsSupportedMimeType(mimeType) || mediaInParts && (topLevelType == "audio" || topLevelType == "video") {
			return nil, nil, fmt.Errorf("mime type is not supported by Gemini function response: %q", mimeType)
		}
		media = append(media, dto.GeminiPart{InlineData: &dto.GeminiInlineData{MimeType: mimeType, Data: data}})
	}
	if len(texts) > 0 {
		return GeminiResponseMap(strings.Join(texts, "\n")), media, nil
	}
	return map[string]any{}, media, nil
}

func appendGeminiContentPart(req *dto.GeminiChatRequest, role string, part dto.GeminiPart) {
	if len(req.Contents) > 0 && req.Contents[len(req.Contents)-1].Role == role {
		parts := req.Contents[len(req.Contents)-1].Parts
		insertAt := len(parts)
		switch {
		case role == "model" && part.FunctionCall != nil:
			insertAt = 0
			for insertAt < len(parts) && parts[insertAt].FunctionCall != nil {
				insertAt++
			}
		case part.FunctionResponse != nil:
			for i := len(parts) - 1; i >= 0; i-- {
				if parts[i].FunctionResponse != nil {
					insertAt = i + 1
					break
				}
			}
		}
		req.Contents[len(req.Contents)-1].Parts = slices.Insert(parts, insertAt, part)
		return
	}
	req.Contents = append(req.Contents, dto.GeminiChatContent{
		Role:  role,
		Parts: []dto.GeminiPart{part},
	})
}

func responsesGeminiRole(item map[string]any) string {
	switch strings.TrimSpace(kitutil.Interface2String(item["role"])) {
	case "assistant":
		return "model"
	case "system", "developer":
		return "system"
	case "model":
		return "model"
	default:
		return "user"
	}
}
