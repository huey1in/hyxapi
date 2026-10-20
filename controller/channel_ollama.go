package controller

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/ollama"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type ollamaModelRequest struct {
	ChannelID int    `json:"channel_id"`
	ModelName string `json:"model_name"`
}

func getOllamaManagementClient(channel *model.Channel) (ollama.ManagementClient, error) {
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return ollama.ManagementClient{}, fmt.Errorf("no enabled channel key is available")
	}
	client, err := service.GetHttpClientWithProxy(channel.GetSetting().Proxy)
	return ollama.ManagementClient{BaseURL: channel.GetBaseURL(), APIKey: key, Client: client}, err
}

func loadOllamaManagement(c *gin.Context, id int) (*model.Channel, ollama.ManagementClient, bool) {
	if id <= 0 {
		common.ApiErrorMsg(c, "Invalid channel ID")
		return nil, ollama.ManagementClient{}, false
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil {
		common.ApiErrorMsg(c, "Channel not found")
		return nil, ollama.ManagementClient{}, false
	}
	if channel.Type != constant.ChannelTypeOllama {
		common.ApiErrorMsg(c, "This operation is only supported for Ollama channels")
		return nil, ollama.ManagementClient{}, false
	}
	client, err := getOllamaManagementClient(channel)
	if err != nil {
		common.ApiError(c, err)
		return nil, ollama.ManagementClient{}, false
	}
	return channel, client, true
}

func parseOllamaModelRequest(c *gin.Context) (ollamaModelRequest, bool) {
	var request ollamaModelRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorMsg(c, "Invalid request parameters")
		return request, false
	}
	request.ModelName = strings.TrimSpace(request.ModelName)
	if request.ChannelID <= 0 || request.ModelName == "" || len(request.ModelName) > 255 {
		common.ApiErrorMsg(c, "Channel ID and model name are required")
		return request, false
	}
	return request, true
}

func OllamaPullModel(c *gin.Context) {
	request, ok := parseOllamaModelRequest(c)
	if !ok {
		return
	}
	channel, client, ok := loadOllamaManagement(c, request.ChannelID)
	if !ok {
		return
	}
	if err := client.Pull(c.Request.Context(), request.ModelName, false, nil); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "channel", channel.Id, "Ollama model pulled: "+request.ModelName)
	common.ApiSuccess(c, nil)
}

func OllamaPullModelStream(c *gin.Context) {
	request, ok := parseOllamaModelRequest(c)
	if !ok {
		return
	}
	channel, client, ok := loadOllamaManagement(c, request.ChannelID)
	if !ok {
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	send := func(value any) {
		data, _ := common.Marshal(value)
		if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", data); err != nil {
			cancel()
			return
		}
		c.Writer.Flush()
	}
	err := client.Pull(ctx, request.ModelName, true, func(progress ollama.OllamaPullResponse) { send(progress) })
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		send(gin.H{"error": err.Error()})
	} else {
		model.RecordLegacyAuditLog(c, model.AuditUpdate, "channel", channel.Id, "Ollama model pulled: "+request.ModelName)
		send(gin.H{"message": fmt.Sprintf("Model %s pulled successfully", request.ModelName)})
	}
	_, _ = fmt.Fprint(c.Writer, "data: [DONE]\n\n")
	c.Writer.Flush()
}

func OllamaDeleteModel(c *gin.Context) {
	request, ok := parseOllamaModelRequest(c)
	if !ok {
		return
	}
	channel, client, ok := loadOllamaManagement(c, request.ChannelID)
	if !ok {
		return
	}
	if err := client.Delete(c.Request.Context(), request.ModelName); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "channel", channel.Id, "Ollama model deleted: "+request.ModelName)
	common.ApiSuccess(c, nil)
}

func OllamaVersion(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	_, client, ok := loadOllamaManagement(c, id)
	if !ok {
		return
	}
	version, err := client.Version(c.Request.Context())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"version": version})
}

func GetOllamaChannelModels(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	channel, client, ok := loadOllamaManagement(c, id)
	if !ok {
		return
	}
	models, err := client.Models(c.Request.Context())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"models": models, "configured_models": normalizeModelNames(channel.GetModels())})
}

func UpdateOllamaChannelModels(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var request struct {
		Action string   `json:"action"`
		Models []string `json:"models"`
	}
	if id <= 0 || c.ShouldBindJSON(&request) != nil || (request.Action != "add" && request.Action != "remove") {
		common.ApiErrorMsg(c, "Invalid request parameters")
		return
	}
	models, err := model.MutateChannelModels(c.Request.Context(), id, constant.ChannelTypeOllama, request.Action == "add", request.Models)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "channel", id, fmt.Sprintf("Ollama channel models %s: %v", request.Action, request.Models))
	common.ApiSuccess(c, gin.H{"models": models})
}
