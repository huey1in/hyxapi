package model

import "github.com/QuantumNous/new-api/common"

// normalizeConsumeLog accepts existing map/string callers and structured task
// metadata while retaining content parts for localized console rendering.
func normalizeConsumeLog(content, metadata any) (string, string) {
	other, ok := metadata.(*LogOther)
	if !ok || other == nil {
		other = NewLogOther()
		if values, ok := metadata.(map[string]any); ok {
			for key, value := range values {
				switch key {
				case logOtherAdminInfoKey:
					if scoped, ok := value.(map[string]any); ok {
						other.MergeAdmin(scoped)
					}
				case logOtherRootInfoKey:
					if scoped, ok := value.(map[string]any); ok {
						other.MergeRoot(scoped)
					}
				case logOtherAuditInfoKey:
					if scoped, ok := value.(map[string]any); ok {
						other.MergeAudit(scoped)
					}
				default:
					other.SetPublic(key, value)
				}
			}
		}
	}
	switch value := content.(type) {
	case []*common.Message:
		return other.setContent(value), other.JSONString()
	case *common.Message:
		return other.setContent([]*common.Message{value}), other.JSONString()
	case string:
		return value, other.JSONString()
	default:
		return "", other.JSONString()
	}
}

type RecordTaskBillingLogParams struct {
	UserId    int
	LogType   int
	Content   []*common.Message
	ChannelId int
	ModelName string
	Quota     int
	TokenId   int
	Group     string
	Other     *LogOther
	NodeName  string
}

func RecordTaskBillingLog(params RecordTaskBillingLogParams) {
	if params.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(params.UserId, false)
	tokenName := ""
	if params.TokenId > 0 {
		if token, err := GetTokenById(params.TokenId); err == nil {
			tokenName = token.Name
		}
	}
	content, other := normalizeConsumeLog(params.Content, params.Other)
	createdAt := common.GetTimestamp()
	log := &Log{UserId: params.UserId, Username: username, CreatedAt: createdAt,
		Type: params.LogType, Content: content, TokenName: tokenName, ModelName: params.ModelName,
		Quota: params.Quota, ChannelId: params.ChannelId, TokenId: params.TokenId, Group: params.Group, Other: other}
	if err := createLog(log); err != nil {
		common.SysError("failed to record task billing log: " + err.Error())
	}
	if params.LogType == LogTypeConsume && common.DataExportEnabled {
		nodeName := params.NodeName
		if nodeName == "" {
			nodeName = common.NodeName
		}
		LogQuotaData(QuotaDataLogParams{UserID: params.UserId, Username: username, ModelName: params.ModelName,
			Quota: params.Quota, CreatedAt: createdAt, UseGroup: params.Group, TokenID: params.TokenId,
			ChannelID: params.ChannelId, NodeName: nodeName})
	}
}
