package dto

import "strings"

// MergeGeminiUsageMetadata overlays cumulative stream snapshots. Omitted scalar
// counters and modalities retain their last value; repeated frames never add
// their counters again. The result owns its slices and billing snapshot.
func MergeGeminiUsageMetadata(current, incoming *GeminiUsageMetadata) *GeminiUsageMetadata {
	if current == nil && incoming == nil {
		return nil
	}
	merged := GeminiUsageMetadata{}
	if current != nil {
		merged = cloneGeminiUsageMetadata(*current)
	}
	if incoming != nil {
		if incoming.PromptTokenCount > 0 {
			merged.PromptTokenCount = incoming.PromptTokenCount
		}
		if incoming.ToolUsePromptTokenCount > 0 {
			merged.ToolUsePromptTokenCount = incoming.ToolUsePromptTokenCount
		}
		if incoming.CandidatesTokenCount > 0 {
			merged.CandidatesTokenCount = incoming.CandidatesTokenCount
		}
		if incoming.ThoughtsTokenCount > 0 {
			merged.ThoughtsTokenCount = incoming.ThoughtsTokenCount
		}
		if incoming.TotalTokenCount > 0 {
			merged.TotalTokenCount = incoming.TotalTokenCount
		}
		if incoming.CachedContentTokenCount > 0 {
			merged.CachedContentTokenCount = incoming.CachedContentTokenCount
		}
		merged.PromptTokensDetails = overlayGeminiTokenDetails(merged.PromptTokensDetails, incoming.PromptTokensDetails)
		merged.ToolUsePromptTokensDetails = overlayGeminiTokenDetails(merged.ToolUsePromptTokensDetails, incoming.ToolUsePromptTokensDetails)
		merged.CandidatesTokensDetails = overlayGeminiTokenDetails(merged.CandidatesTokensDetails, incoming.CandidatesTokensDetails)
	}
	if total := merged.PromptTokenCount + merged.ToolUsePromptTokenCount + merged.CandidatesTokenCount + merged.ThoughtsTokenCount; total > merged.TotalTokenCount {
		merged.TotalTokenCount = total
	}
	merged.BillingUsage = NewGeminiChatBillingUsage(&merged)
	return &merged
}

func overlayGeminiTokenDetails(current, incoming []GeminiPromptTokensDetails) []GeminiPromptTokensDetails {
	reported := make(map[string]bool, len(incoming))
	for _, detail := range incoming {
		reported[strings.ToUpper(strings.TrimSpace(detail.Modality))] = true
	}
	merged := make([]GeminiPromptTokensDetails, 0, len(current)+len(incoming))
	for _, detail := range current {
		detail.Modality = strings.ToUpper(strings.TrimSpace(detail.Modality))
		if !reported[detail.Modality] {
			merged = append(merged, detail)
		}
	}
	for _, detail := range incoming {
		detail.Modality = strings.ToUpper(strings.TrimSpace(detail.Modality))
		merged = append(merged, detail)
	}
	return merged
}
