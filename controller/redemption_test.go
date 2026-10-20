package controller

import (
	"errors"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRedemptionBatchRollsBackAllCodesWhenAnyInsertFails(t *testing.T) {
	require.NoError(t, i18n.Init())
	user := paymentFixture(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Redemption{}))
	confirmPaymentComplianceForTest(t)
	inserts := 0
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register("fail_redemption_batch", func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "redemptions" {
			inserts++
			if inserts == 2 {
				tx.AddError(errors.New("batch fixture unavailable"))
			}
		}
	}))
	response := paymentRequest(t, AddRedemption, user.Id, `{"count":3,"quota":10}`, "")
	var result struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.False(t, result.Success)
	require.Empty(t, result.Data)
	var count int64
	require.NoError(t, model.DB.Model(&model.Redemption{}).Count(&count).Error)
	require.Zero(t, count, "a failed batch must not leave redeemable codes behind")
	response = paymentRequest(t, AddRedemption, user.Id, `{"count":3,"quota":10}`, "")
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success)
	require.Len(t, result.Data, 3)
	require.NoError(t, model.DB.Model(&model.Redemption{}).Count(&count).Error)
	require.EqualValues(t, 3, count)
}

func TestRedemptionCreationAndBatchValidation(t *testing.T) {
	user := paymentFixture(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Redemption{}))
	confirmPaymentComplianceForTest(t)
	for _, body := range []string{
		`{"name":"credit","count":1,"quota":0}`,
		`{"name":"credit","count":1,"quota":-1}`,
		`{"name":"credit","count":1,"quota":9007199254740992}`,
		`{"name":"123456789012345678901","count":1,"quota":10}`,
		`{"name":"credit","count":101,"quota":10}`,
	} {
		response := paymentRequest(t, AddRedemption, user.Id, body, "")
		var data struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &data))
		require.False(t, data.Success, body)
	}
	response := paymentRequest(t, AddRedemption, user.Id, `{"name":"一二三四五六七八九十一二三四五六七八九十","count":2,"quota":10}`, "")
	var data struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &data))
	require.True(t, data.Success, response.Body.String())
	require.Len(t, data.Data, 2)
	for _, body := range []string{`{"ids":[]}`, `{"ids":[0]}`, `{"ids":[-1]}`} {
		response = paymentRequest(t, DeleteRedemptionBatch, user.Id, body, "")
		var invalid struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &invalid))
		require.False(t, invalid.Success)
	}
}

func TestRedemptionCreationRequiresComplianceAndUsedStatusCannotBeReset(t *testing.T) {
	user := paymentFixture(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Redemption{}))
	confirmPaymentComplianceForTest(t)
	setting := operation_setting.GetPaymentSetting()
	setting.ComplianceConfirmed = false
	response := paymentRequest(t, AddRedemption, user.Id, `{"name":"credit","count":1,"quota":10}`, "")
	var result struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.False(t, result.Success)
	code := model.Redemption{Key: "already-used", Quota: 10, Status: common.RedemptionCodeStatusUsed, UsedUserId: user.Id}
	require.NoError(t, model.DB.Create(&code).Error)
	for _, status := range []int{1, 2, 3, 99} {
		response = paymentRequest(t, func(c *gin.Context) { c.Request.URL.RawQuery = "status_only=true"; UpdateRedemption(c) }, user.Id, fmt.Sprintf(`{"id":%d,"status":%d}`, code.Id, status), "")
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		require.False(t, result.Success)
	}
	require.NoError(t, model.DB.First(&code, code.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, code.Status)
}
