package dto

type SwapFaceRequest struct {
	SourceBase64 string `json:"sourceBase64"`
	TargetBase64 string `json:"targetBase64"`
}

type MidjourneyRequest struct {
	Prompt      string   `json:"prompt"`
	CustomId    string   `json:"customId"`
	BotType     string   `json:"botType"`
	NotifyHook  string   `json:"notifyHook"`
	Action      string   `json:"action"`
	Index       int      `json:"index"`
	State       string   `json:"state"`
	TaskId      string   `json:"taskId"`
	Base64Array []string `json:"base64Array"`
	Content     string   `json:"content"`
	MaskBase64  string   `json:"maskBase64"`
}

type MidjourneyResponse struct {
	Code        int    `json:"code"`
	Description string `json:"description"`
	Properties  any    `json:"properties"`
	Result      string `json:"result"`
}

type MidjourneyUploadResponse struct {
	Code        int      `json:"code"`
	Description string   `json:"description"`
	Result      []string `json:"result"`
}

type MidjourneyResponseWithStatusCode struct {
	StatusCode int `json:"statusCode"`
	Response   MidjourneyResponse
}

type MidjourneyDto struct {
	MjId        string      `json:"id"`
	Action      string      `json:"action"`
	CustomId    string      `json:"customId"`
	BotType     string      `json:"botType"`
	Prompt      string      `json:"prompt"`
	PromptEn    string      `json:"promptEn"`
	Description string      `json:"description"`
	State       string      `json:"state"`
	SubmitTime  int64       `json:"submitTime"`
	StartTime   int64       `json:"startTime"`
	FinishTime  int64       `json:"finishTime"`
	ImageUrl    string      `json:"imageUrl"`
	VideoUrl    string      `json:"videoUrl"`
	VideoUrls   []ImgUrls   `json:"videoUrls"`
	Status      string      `json:"status"`
	Progress    string      `json:"progress"`
	FailReason  string      `json:"failReason"`
	Buttons     any         `json:"buttons"`
	MaskBase64  string      `json:"maskBase64"`
	Properties  *Properties `json:"properties"`
}

type ImgUrls struct {
	Url string `json:"url"`
}

type ActionButton struct {
	CustomId any `json:"customId"`
	Emoji    any `json:"emoji"`
	Label    any `json:"label"`
	Type     any `json:"type"`
	Style    any `json:"style"`
}

type Properties struct {
	FinalPrompt   string `json:"finalPrompt"`
	FinalZhPrompt string `json:"finalZhPrompt"`
}
