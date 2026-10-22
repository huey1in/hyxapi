package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func attachQuotaSaturationToOther(other *model.LogOther, clamp *common.QuotaClamp) {
	if clamp == nil || other == nil {
		return
	}
	other.SetAdmin("quota_saturation", clamp.AuditMap())
}

func attachQuotaSaturation(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, other *model.LogOther) {
	if relayInfo == nil {
		return
	}
	clamp := relayInfo.QuotaClamp
	if clamp == nil {
		return
	}
	attachQuotaSaturationToOther(other, clamp)
	logger.LogWarn(ctx, fmt.Sprintf("quota saturation on consume log: op=%s kind=%s original=%g clamped=%d user=%d model=%s",
		clamp.Op, clamp.Kind, clamp.Original, clamp.Clamped, relayInfo.UserId, relayInfo.GetBillingModelName()))
}
