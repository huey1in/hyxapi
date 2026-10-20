package controller

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const modelsDevPricingURL = "https://models.dev/api.json"

type modelPricingSyncPreview struct {
	ModelName         string              `json:"model_name"`
	Provider          string              `json:"provider"`
	Status            string              `json:"status"`
	Description       string              `json:"description,omitempty"`
	DescriptionAction string              `json:"description_action,omitempty"`
	Local             *model.ModelPricing `json:"local"`
	Upstream          model.ModelPricing  `json:"upstream"`
}

type modelPricingSyncApplyRequest struct {
	ModelNames []string `json:"model_names"`
}

func sameSyncPricing(a, b model.ModelPricing) bool {
	return a.BillingType == b.BillingType &&
		a.InputPrice == b.InputPrice &&
		a.OutputPrice == b.OutputPrice &&
		a.CacheReadPrice == b.CacheReadPrice &&
		a.CacheWritePrice == b.CacheWritePrice &&
		a.ImagePrice == b.ImagePrice &&
		a.AudioInputPrice == b.AudioInputPrice &&
		a.AudioOutputPrice == b.AudioOutputPrice &&
		a.RequestPrice == b.RequestPrice &&
		a.Enabled == b.Enabled
}

func buildModelPricingSyncPreview(local []model.ModelPricing, upstream []model.UpstreamModelPricing, descriptions map[string]string) []modelPricingSyncPreview {
	localByName := make(map[string]model.ModelPricing, len(local))
	for _, pricing := range local {
		localByName[pricing.ModelName] = pricing
	}
	preview := make([]modelPricingSyncPreview, 0)
	for _, item := range upstream {
		upstreamPricing := item.Pricing
		upstreamPricing.ID = 0
		upstreamPricing.CreatedTime = 0
		upstreamPricing.UpdatedTime = 0
		entry := modelPricingSyncPreview{
			ModelName:         upstreamPricing.ModelName,
			Provider:          item.Provider,
			Status:            "new",
			Description:       item.Description,
			DescriptionAction: "add",
			Upstream:          upstreamPricing,
		}
		if strings.TrimSpace(descriptions[upstreamPricing.ModelName]) != "" {
			entry.DescriptionAction = "preserve"
		}
		if localPricing, exists := localByName[upstreamPricing.ModelName]; exists {
			descriptionMissing := strings.TrimSpace(descriptions[upstreamPricing.ModelName]) == "" && strings.TrimSpace(item.Description) != ""
			if sameSyncPricing(localPricing, upstreamPricing) && !descriptionMissing {
				continue
			}
			copy := localPricing
			entry.Local = &copy
			if sameSyncPricing(localPricing, upstreamPricing) {
				entry.Status = "description"
			} else {
				entry.Status = "changed"
			}
		}
		preview = append(preview, entry)
	}
	sort.Slice(preview, func(i, j int) bool { return preview[i].ModelName < preview[j].ModelName })
	return preview
}

func fetchEnabledUpstreamModelPrices() ([]model.UpstreamModelPricing, []string, error) {
	client := newModelPricingSyncHTTPClient(30 * time.Second)
	prices, err := model.FetchModelsDevPrices(client, modelsDevPricingURL)
	if err != nil {
		return nil, nil, err
	}
	enabledModels := model.GetEnabledModels()
	return model.FilterUpstreamModelPrices(prices, enabledModels), enabledModels, nil
}

func AdminPreviewModelPricingSync(c *gin.Context) {
	upstream, _, err := fetchEnabledUpstreamModelPrices()
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "获取上游模型价格失败：" + err.Error()})
		return
	}
	local, err := model.ListModelPricings(true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	modelNames := make([]string, 0, len(upstream))
	for _, item := range upstream {
		modelNames = append(modelNames, item.Pricing.ModelName)
	}
	descriptions, err := model.GetModelDescriptions(modelNames)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    buildModelPricingSyncPreview(local, upstream, descriptions),
	})
}

func AdminApplyModelPricingSync(c *gin.Context) {
	var request modelPricingSyncApplyRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的同步参数"})
		return
	}
	upstream, enabledModels, err := fetchEnabledUpstreamModelPrices()
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "获取上游模型价格失败：" + err.Error()})
		return
	}
	saved, err := model.ApplyModelPricingSync(upstream, request.ModelNames, enabledModels)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	model.RecordLegacyAuditLog(c, model.AuditUpdate, "model_pricing", 0, "同步上游模型价格")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"saved": saved},
	})
}
