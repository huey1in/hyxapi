package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetChannelKeepsRequestPricingSnapshot(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		OriginModelName: "pricing-snapshot-model",
		UsingGroup:      "pricing-snapshot-group",
		ChannelMeta:     &relaycommon.ChannelMeta{},
		PriceData: types.PriceData{
			GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 7},
		},
	}

	_, err := getChannel(ctx, info, &service.RetryParam{
		TokenGroup: info.UsingGroup,
		ModelName:  info.OriginModelName,
	})

	require.NotNil(t, err)
	require.Equal(t, 7.0, info.PriceData.GroupRatioInfo.GroupRatio)
}
