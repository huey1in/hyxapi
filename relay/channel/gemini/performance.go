package gemini

import (
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/tidwall/gjson"
)

func observeGeminiResponseOutcome(info *relaycommon.RelayInfo, response *dto.GeminiChatResponse, raw string) {
	info.ObserveResponseModel(gjson.Get(raw, "modelVersion").Str)
	if len(response.Candidates) == 0 && response.PromptFeedback != nil && response.PromptFeedback.BlockReason != nil {
		info.PerformanceBusinessRejection = true
	}
	for _, candidate := range response.Candidates {
		if candidate.FinishReason == nil || *candidate.FinishReason == "" || *candidate.FinishReason == "FINISH_REASON_UNSPECIFIED" {
			continue
		}
		switch *candidate.FinishReason {
		case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT", "IMAGE_RECITATION":
			info.PerformanceBusinessRejection = true
		}
		info.StreamStatus.MarkCompleted()
	}
}
