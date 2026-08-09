package types

import relaytypes "github.com/QuantumNous/new-api/relaykit/types"

type RelayFormat = relaytypes.RelayFormat

const (
	RelayFormatOpenAI                    = relaytypes.RelayFormatOpenAI
	RelayFormatClaude                    = relaytypes.RelayFormatClaude
	RelayFormatGemini                    = relaytypes.RelayFormatGemini
	RelayFormatOpenAIResponses           = relaytypes.RelayFormatOpenAIResponses
	RelayFormatOpenAIResponsesCompaction = relaytypes.RelayFormatOpenAIResponsesCompaction
	RelayFormatOpenAIAudio               = relaytypes.RelayFormatOpenAIAudio
	RelayFormatOpenAIImage               = relaytypes.RelayFormatOpenAIImage
	RelayFormatOpenAIRealtime            = relaytypes.RelayFormatOpenAIRealtime
	RelayFormatRerank                    = relaytypes.RelayFormatRerank
	RelayFormatEmbedding                 = relaytypes.RelayFormatEmbedding

	RelayFormatTask    = relaytypes.RelayFormatTask
	RelayFormatMjProxy = relaytypes.RelayFormatMjProxy
)
