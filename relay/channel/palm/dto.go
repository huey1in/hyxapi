package palm

import "github.com/QuantumNous/new-api/relaykit/dto"

type PaLMChatMessage struct {
	Author  string `json:"author"`
	Content string `json:"content"`
}

type PaLMFilter struct {
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

type PaLMError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  string `json:"status"`
}

type PaLMChatResponse struct {
	Candidates []PaLMChatMessage `json:"candidates"`
	Messages   []dto.Message     `json:"messages"`
	Filters    []PaLMFilter      `json:"filters"`
	Error      PaLMError         `json:"error"`
}
