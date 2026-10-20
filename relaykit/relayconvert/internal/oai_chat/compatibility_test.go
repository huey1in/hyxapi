package oaichat

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestGeminiComplexSchemasArePreserved(t *testing.T) {
	const schema = `{"type":"object","properties":{"mode":{"const":"safe"},"value":{"$ref":"#/$defs/value"}},"$defs":{"value":{"oneOf":[{"type":"number"},{"enum":[true,false]}]}}}`
	var parameters any
	require.NoError(t, json.Unmarshal([]byte(schema), &parameters))
	for _, enabled := range []bool{true, false} {
		info := &convmeta.Values{Options: &convmeta.Options{Gemini: convmeta.GeminiOptions{SupportsJSONSchema: func(string) bool { return enabled }}}}
		request := dto.GeneralOpenAIRequest{Model: "gemini-3-flash", Tools: []dto.ToolCallRequest{{Type: "function", Function: dto.FunctionRequest{Name: "read", Parameters: parameters}}}, ResponseFormat: &dto.ResponseFormat{Type: "json_schema", JsonSchema: json.RawMessage(`{"schema":` + schema + `}`)}}
		got, err := OpenAIChatRequestToGeminiGenerateContent(context.Background(), request, info)
		require.NoError(t, err)
		body, err := json.Marshal(got)
		require.NoError(t, err)
		if enabled {
			require.Equal(t, "safe", gjson.GetBytes(body, "tools.0.functionDeclarations.0.parametersJsonSchema.properties.mode.const").String())
			require.JSONEq(t, schema, string(got.GenerationConfig.ResponseJsonSchema))
			require.False(t, gjson.GetBytes(body, "tools.0.functionDeclarations.0.parameters").Exists())
		} else {
			require.False(t, gjson.GetBytes(body, "tools.0.functionDeclarations.0.parametersJsonSchema").Exists())
			require.Empty(t, got.GenerationConfig.ResponseJsonSchema)
		}
	}
}

func TestResponsesImageDetailPreserved(t *testing.T) {
	for _, detail := range []string{"", "auto", "low", "high", "original", "bogus"} {
		t.Run(detail, func(t *testing.T) {
			req := &dto.GeneralOpenAIRequest{Model: "image", Messages: []dto.Message{{Role: "user", Content: []any{map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.test/a.png", "detail": detail}}}}}}
			got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), req)
			require.NoError(t, err)
			want := detail
			if detail == "" || detail == "bogus" {
				want = "auto"
			}
			require.Equal(t, want, gjson.GetBytes(got.Input, "0.content.0.detail").String())
		})
	}
}

func TestClaudeStreamRetainsReasoningAndTextInSameChunk(t *testing.T) {
	for _, count := range []int{1, 2} {
		info := &convmeta.Values{SendResponseCount: count}
		reasoning, text := "thought", "answer"
		events := StreamResponseOpenAI2Claude(&dto.ChatCompletionsStreamResponse{Choices: []dto.ChatCompletionsStreamResponseChoice{{Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ReasoningContent: &reasoning, Content: &text}}}}, info)
		var kinds []string
		for _, event := range events {
			if event.Delta != nil {
				kinds = append(kinds, event.Delta.Type)
			}
		}
		require.Equal(t, []string{"thinking_delta", "text_delta"}, kinds)
		for _, event := range events {
			if event.Type == "content_block_stop" {
				require.Equal(t, 0, event.GetIndex())
			}
		}
		require.Equal(t, 1, info.ClaudeConvertInfo.Index)
	}
}

func TestReasoningItemAlwaysHasSummary(t *testing.T) {
	data, err := json.Marshal(dto.ResponsesOutput{Type: "reasoning"})
	require.NoError(t, err)
	require.Equal(t, "[]", gjson.GetBytes(data, "summary").Raw)
}
