package relayconvert

import (
	"context"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func ApplyGeminiThinkingConfigChecked(geminiRequest *dto.GeminiChatRequest, info convmeta.Meta, oaiRequest ...dto.GeneralOpenAIRequest) error {
	ctx, collector := convdiag.WithCollector(context.Background())
	err := reasoning.AsClientError(sharedgemini.ApplyThinkingConfig(ctx, geminiRequest, info, oaiRequest...))
	if recorder, ok := info.(interface {
		RecordConversionDiagnostics(context.Context, []types.ConversionDiagnostic)
	}); ok {
		diagnostics := collector.Diagnostics()
		for i := range diagnostics {
			if diagnostics[i].To == "" {
				diagnostics[i].To = types.RelayFormatGemini
			}
		}
		recorder.RecordConversionDiagnostics(ctx, diagnostics)
	}
	return err
}

func ApplyClaudeThinkingModel(claudeRequest *dto.ClaudeRequest, info convmeta.Meta) error {
	ctx, collector := convdiag.WithCollector(context.Background())
	err := reasoning.AsClientError(sharedclaude.ApplyReasoning(ctx, claudeRequest, info, reasoning.Intent{}, false))
	if recorder, ok := info.(interface {
		RecordConversionDiagnostics(context.Context, []types.ConversionDiagnostic)
	}); ok {
		recorder.RecordConversionDiagnostics(ctx, collector.Diagnostics())
	}
	return err
}
