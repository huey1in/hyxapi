package constant

import relaytypes "github.com/QuantumNous/new-api/relaykit/types"

type EndpointType = relaytypes.EndpointType

const (
	EndpointTypeOpenAI                = relaytypes.EndpointTypeOpenAI
	EndpointTypeOpenAIResponse        = relaytypes.EndpointTypeOpenAIResponse
	EndpointTypeOpenAIResponseCompact = relaytypes.EndpointTypeOpenAIResponseCompact
	EndpointTypeAnthropic             = relaytypes.EndpointTypeAnthropic
	EndpointTypeGemini                = relaytypes.EndpointTypeGemini
	EndpointTypeJinaRerank            = relaytypes.EndpointTypeJinaRerank
	EndpointTypeImageGeneration       = relaytypes.EndpointTypeImageGeneration
	EndpointTypeEmbeddings            = relaytypes.EndpointTypeEmbeddings
	EndpointTypeOpenAIVideo           = relaytypes.EndpointTypeOpenAIVideo
	//EndpointTypeMidjourney     EndpointType = "midjourney-proxy"
	//EndpointTypeSuno           EndpointType = "suno-proxy"
	//EndpointTypeKling          EndpointType = "kling"
	//EndpointTypeJimeng         EndpointType = "jimeng"
)
