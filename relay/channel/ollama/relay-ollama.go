package ollama

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func toOllamaResponseFormat(responseFormat *dto.ResponseFormat) (any, error) {
	if responseFormat == nil {
		return nil, nil
	}
	switch responseFormat.Type {
	case "json", "json_object":
		return "json", nil
	case "json_schema":
		if len(responseFormat.JsonSchema) == 0 {
			return nil, nil
		}
		var jsonSchema dto.FormatJsonSchema
		if err := common.Unmarshal(responseFormat.JsonSchema, &jsonSchema); err != nil {
			return nil, fmt.Errorf("invalid ollama response format: %w", err)
		}
		return jsonSchema.Schema, nil
	default:
		return nil, nil
	}
}

func openAIChatToOllamaChat(c *gin.Context, r *dto.GeneralOpenAIRequest) (*OllamaChatRequest, error) {
	think := r.Think
	if len(think) == 0 {
		effort := r.ReasoningEffort
		if len(r.Reasoning) > 0 {
			var reasoning dto.Reasoning
			if err := common.Unmarshal(r.Reasoning, &reasoning); err != nil {
				return nil, fmt.Errorf("invalid ollama reasoning: %w", err)
			}
			effort = lo.CoalesceOrEmpty(reasoning.Effort, effort)
		}
		if effort != "" {
			var thinkValue any
			switch effort {
			case "none":
				thinkValue = false
			case "low", "medium", "high", "max":
				thinkValue = effort
			default:
				return nil, fmt.Errorf("unsupported ollama reasoning effort %q", effort)
			}
			var err error
			think, err = common.Marshal(thinkValue)
			if err != nil {
				return nil, fmt.Errorf("marshal ollama think: %w", err)
			}
		}
	}

	chatReq := &OllamaChatRequest{
		Model:   r.Model,
		Stream:  lo.FromPtrOr(r.Stream, false),
		Options: map[string]any{},
		Think:   think,
	}
	format, err := toOllamaResponseFormat(r.ResponseFormat)
	if err != nil {
		return nil, err
	}
	chatReq.Format = format

	// options mapping
	if r.Temperature != nil {
		chatReq.Options["temperature"] = r.Temperature
	}
	if r.TopP != nil {
		chatReq.Options["top_p"] = lo.FromPtr(r.TopP)
	}
	if r.TopK != nil {
		chatReq.Options["top_k"] = lo.FromPtr(r.TopK)
	}
	if r.FrequencyPenalty != nil {
		chatReq.Options["frequency_penalty"] = lo.FromPtr(r.FrequencyPenalty)
	}
	if r.PresencePenalty != nil {
		chatReq.Options["presence_penalty"] = lo.FromPtr(r.PresencePenalty)
	}
	if r.Seed != nil {
		chatReq.Options["seed"] = int(lo.FromPtr(r.Seed))
	}
	if mt := r.GetMaxTokens(); mt != 0 {
		chatReq.Options["num_predict"] = int(mt)
	}

	if r.Stop != nil {
		switch v := r.Stop.(type) {
		case string:
			chatReq.Options["stop"] = []string{v}
		case []string:
			chatReq.Options["stop"] = v
		case []any:
			arr := lo.FilterMap(v, func(item any, _ int) (string, bool) {
				value, ok := item.(string)
				return value, ok
			})
			if len(arr) > 0 {
				chatReq.Options["stop"] = arr
			}
		}
	}

	if len(r.Tools) > 0 {
		chatReq.Tools = lo.Map(r.Tools, func(tool dto.ToolCallRequest, _ int) OllamaTool {
			return OllamaTool{
				Type: "function",
				Function: OllamaToolFunction{
					Name:        tool.Function.Name,
					Description: tool.Function.Description,
					Parameters:  tool.Function.Parameters,
				},
			}
		})
	}

	chatReq.Messages = make([]OllamaChatMessage, 0, len(r.Messages))
	toolNamesByCallID := make(map[string]string)
	for _, m := range r.Messages {
		var textBuilder strings.Builder
		var images []string
		if m.IsStringContent() {
			textBuilder.WriteString(m.StringContent())
		} else {
			parts := m.ParseContent()
			for _, part := range parts {
				if part.Type == dto.ContentTypeImageURL {
					source := part.ToFileSource()
					if source != nil {
						base64Data, _, err := service.GetBase64Data(c, source, "fetch image for ollama chat")
						if err != nil {
							return nil, err
						}
						if base64Data != "" {
							images = append(images, base64Data)
						}
					}
				} else if part.Type == dto.ContentTypeText {
					textBuilder.WriteString(part.Text)
				}
			}
		}
		cm := OllamaChatMessage{Role: m.Role, Content: textBuilder.String()}
		if len(images) > 0 {
			cm.Images = images
		}
		if m.Role == "assistant" {
			if reasoning, ok := lo.Coalesce(m.ReasoningContent, m.Reasoning); ok {
				thinking, err := common.Marshal(*reasoning)
				if err != nil {
					return nil, fmt.Errorf("marshal ollama thinking: %w", err)
				}
				cm.Thinking = thinking
			}
		}
		if m.Role == "tool" {
			cm.ToolCallID = m.ToolCallId
			cm.ToolName = lo.CoalesceOrEmpty(lo.FromPtr(m.Name), toolNamesByCallID[m.ToolCallId])
		}
		if m.ToolCalls != nil && len(m.ToolCalls) > 0 {
			parsed := m.ParseToolCalls()
			if len(parsed) > 0 {
				calls := make([]OllamaToolCall, 0, len(parsed))
				for _, tc := range parsed {
					var args any
					if tc.Function.Arguments != "" {
						_ = common.Unmarshal([]byte(tc.Function.Arguments), &args)
					}
					if args == nil {
						args = map[string]any{}
					}
					oc := OllamaToolCall{ID: tc.ID}
					oc.Function.Name = tc.Function.Name
					oc.Function.Arguments = args
					calls = append(calls, oc)
					if tc.ID != "" {
						toolNamesByCallID[tc.ID] = tc.Function.Name
					}
				}
				cm.ToolCalls = calls
			}
		}
		chatReq.Messages = append(chatReq.Messages, cm)
	}
	return chatReq, nil
}

// openAIToGenerate converts OpenAI completions request to Ollama generate
func openAIToGenerate(c *gin.Context, r *dto.GeneralOpenAIRequest) (*OllamaGenerateRequest, error) {
	gen := &OllamaGenerateRequest{
		Model:   r.Model,
		Stream:  lo.FromPtrOr(r.Stream, false),
		Options: map[string]any{},
		Think:   r.Think,
	}
	// Prompt may be in r.Prompt (string or []any)
	if r.Prompt != nil {
		switch v := r.Prompt.(type) {
		case string:
			gen.Prompt = v
		case []any:
			var sb strings.Builder
			for _, it := range v {
				if s, ok := it.(string); ok {
					sb.WriteString(s)
				}
			}
			gen.Prompt = sb.String()
		default:
			gen.Prompt = fmt.Sprintf("%v", r.Prompt)
		}
	}
	if r.Suffix != nil {
		if s, ok := r.Suffix.(string); ok {
			gen.Suffix = s
		}
	}
	format, err := toOllamaResponseFormat(r.ResponseFormat)
	if err != nil {
		return nil, err
	}
	gen.Format = format
	if r.Temperature != nil {
		gen.Options["temperature"] = r.Temperature
	}
	if r.TopP != nil {
		gen.Options["top_p"] = lo.FromPtr(r.TopP)
	}
	if r.TopK != nil {
		gen.Options["top_k"] = lo.FromPtr(r.TopK)
	}
	if r.FrequencyPenalty != nil {
		gen.Options["frequency_penalty"] = lo.FromPtr(r.FrequencyPenalty)
	}
	if r.PresencePenalty != nil {
		gen.Options["presence_penalty"] = lo.FromPtr(r.PresencePenalty)
	}
	if r.Seed != nil {
		gen.Options["seed"] = int(lo.FromPtr(r.Seed))
	}
	if mt := r.GetMaxTokens(); mt != 0 {
		gen.Options["num_predict"] = int(mt)
	}
	if r.Stop != nil {
		switch v := r.Stop.(type) {
		case string:
			gen.Options["stop"] = []string{v}
		case []string:
			gen.Options["stop"] = v
		case []any:
			arr := lo.FilterMap(v, func(item any, _ int) (string, bool) {
				value, ok := item.(string)
				return value, ok
			})
			if len(arr) > 0 {
				gen.Options["stop"] = arr
			}
		}
	}
	return gen, nil
}

func requestOpenAI2Embeddings(r dto.EmbeddingRequest) *OllamaEmbeddingRequest {
	opts := map[string]any{}
	if r.Temperature != nil {
		opts["temperature"] = r.Temperature
	}
	if r.TopP != nil {
		opts["top_p"] = lo.FromPtr(r.TopP)
	}
	if r.FrequencyPenalty != nil {
		opts["frequency_penalty"] = lo.FromPtr(r.FrequencyPenalty)
	}
	if r.PresencePenalty != nil {
		opts["presence_penalty"] = lo.FromPtr(r.PresencePenalty)
	}
	if r.Seed != nil {
		opts["seed"] = int(lo.FromPtr(r.Seed))
	}
	dimensions := lo.FromPtrOr(r.Dimensions, 0)
	if r.Dimensions != nil {
		opts["dimensions"] = dimensions
	}
	input := r.ParseInput()
	if len(input) == 1 {
		return &OllamaEmbeddingRequest{Model: r.Model, Input: input[0], Options: opts, Dimensions: dimensions}
	}
	return &OllamaEmbeddingRequest{Model: r.Model, Input: input, Options: opts, Dimensions: dimensions}
}

func ollamaEmbeddingHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	var oResp OllamaEmbeddingResponse
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	if err = common.Unmarshal(body, &oResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oResp.Error != "" {
		return nil, types.NewOpenAIError(fmt.Errorf("ollama error: %s", oResp.Error), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	data := make([]dto.OpenAIEmbeddingResponseItem, 0, len(oResp.Embeddings))
	for i, emb := range oResp.Embeddings {
		data = append(data, dto.OpenAIEmbeddingResponseItem{Index: i, Object: "embedding", Embedding: emb})
	}
	usage := &dto.Usage{PromptTokens: oResp.PromptEvalCount, CompletionTokens: 0, TotalTokens: oResp.PromptEvalCount}
	embResp := &dto.OpenAIEmbeddingResponse{Object: "list", Data: data, Model: info.UpstreamModelName, Usage: *usage}
	out, _ := common.Marshal(embResp)
	service.IOCopyBytesGracefully(c, resp, out)
	return usage, nil
}
