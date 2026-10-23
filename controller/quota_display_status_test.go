package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetStatusUsesQuotaDisplayTypeWithoutLegacyCurrencyFlag(t *testing.T) {
	settings := operation_setting.GetGeneralSetting()
	original := *settings
	t.Cleanup(func() { *settings = original })
	settings.CustomCurrencySymbol = "credits"
	settings.CustomCurrencyExchangeRate = 2.5
	for _, displayType := range []string{"USD", "CNY", "TOKENS", "CUSTOM"} {
		t.Run(displayType, func(t *testing.T) {
			settings.QuotaDisplayType = displayType
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)
			GetStatus(ctx)
			require.Equal(t, http.StatusOK, recorder.Code)
			var response struct {
				Success bool           `json:"success"`
				Data    map[string]any `json:"data"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			require.True(t, response.Success)
			require.NotContains(t, response.Data, "display_in_currency")
			require.Equal(t, displayType, response.Data["quota_display_type"])
			require.Equal(t, "credits", response.Data["custom_currency_symbol"])
			require.Equal(t, 2.5, response.Data["custom_currency_exchange_rate"])
		})
	}
}
