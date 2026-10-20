package oairesponses

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

func TestGeminiResponsesToolMediaPlacement(t *testing.T) {
	relaymedia.SetMediaResolver(relaymedia.MediaResolver{GetBase64Data: func(context.Context, types.FileSource, ...string) (string, string, error) {
		return "cG5n", "image/png", nil
	}})
	t.Cleanup(func() { relaymedia.SetMediaResolver(relaymedia.MediaResolver{}) })
	for _, model := range []string{"gemini-3-flash-preview", "models/gemini-2.5-pro", "future-model"} {
		t.Run(model, func(t *testing.T) {
			input, err := json.Marshal([]map[string]any{
				{"type": "custom_tool_call", "call_id": "c1", "name": "lookup", "input": "find image"},
				{"type": "function_call", "call_id": "c2", "name": "other", "arguments": "{}"},
				{"type": "custom_tool_call_output", "call_id": "c1", "output": []any{map[string]any{"type": "input_text", "text": "found"}, map[string]any{"type": "input_image", "image_url": "data:image/png;base64,cG5n"}}},
				{"type": "function_call_output", "call_id": "c2", "output": "done"},
			})
			require.NoError(t, err)
			prepared := dto.OpenAIResponsesRequest{Model: model, Input: input}
			got, err := OpenAIResponsesRequestToGeminiChat(context.Background(), &prepared, nil)
			require.NoError(t, err)
			require.Len(t, got.Contents, 2)
			require.Len(t, got.Contents[0].Parts, 2)
			require.Equal(t, map[string]any{"input": "find image"}, got.Contents[0].Parts[0].FunctionCall.Arguments)
			require.Equal(t, "c1", got.Contents[0].Parts[0].FunctionCall.ID)
			parts := got.Contents[1].Parts
			response := parts[0].FunctionResponse
			require.NotNil(t, response)
			require.Equal(t, "lookup", response.Name)
			require.JSONEq(t, `"c1"`, string(response.ID))
			require.Equal(t, map[string]any{"content": "found"}, response.Response)
			require.NotNil(t, parts[1].FunctionResponse)
			if model == "models/gemini-2.5-pro" {
				require.Len(t, parts, 3)
				require.Empty(t, response.Parts)
				require.Equal(t, &dto.GeminiInlineData{MimeType: "image/png", Data: "cG5n"}, parts[2].InlineData)
			} else {
				require.Len(t, parts, 2)
				require.JSONEq(t, `[{"inlineData":{"mimeType":"image/png","data":"cG5n"}}]`, string(response.Parts))
			}
		})
	}
}

func TestGeminiResponsesToolMediaReportsUnsupportedOrFailedLoads(t *testing.T) {
	t.Cleanup(func() { relaymedia.SetMediaResolver(relaymedia.MediaResolver{}) })
	for _, tc := range []struct {
		name, mime string
		loadErr    error
		inParts    bool
		wantError  bool
	}{
		{"unsupported", "application/zip", nil, false, true},
		{"failed load", "image/png", errors.New("load denied"), true, true},
		{"audio function response", "audio/ogg", nil, true, true},
		{"audio legacy inline", "audio/ogg", nil, false, false},
		{"document", "text/markdown", nil, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			relaymedia.SetMediaResolver(relaymedia.MediaResolver{GetBase64Data: func(context.Context, types.FileSource, ...string) (string, string, error) {
				return "cG5n", tc.mime, tc.loadErr
			}})
			ctx, collector := convdiag.WithCollector(context.Background())
			output, media := responsesToolOutputToGemini(ctx, []any{map[string]any{"type": "input_file", "file_data": "data:application/octet-stream;base64,cG5n"}}, tc.inParts)
			if tc.wantError {
				require.NotEmpty(t, collector.Diagnostics())
				require.Equal(t, "unsupported_media_type", collector.Diagnostics()[0].Code)
				require.NotEmpty(t, output)
				require.Empty(t, media)
			} else {
				require.Empty(t, collector.Diagnostics())
				require.Empty(t, output)
				require.Len(t, media, 1)
			}
		})
	}
}
