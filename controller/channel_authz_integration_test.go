package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelEditEnforcesFieldAndTokenPermissions(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	url := "https://provider.example"
	channel := &model.Channel{Type: 1, Key: "preserve-key", Name: "before", BaseURL: &url,
		Models: "gpt-4o", Group: "default", Status: 1, UsedQuota: 7654, Balance: 12.5, CreatedTime: 123}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, authz.SetUserPermissions(2, authz.PermissionsMap{authz.ResourceChannel: {authz.ActionWrite: true, authz.ActionSensitiveWrite: false}}))
	role := common.RoleAdminUser
	var tokenScopes []string
	request := func(fields string) *httptest.ResponseRecorder {
		router := gin.New()
		router.PUT("/channel", func(c *gin.Context) {
			c.Set("id", 2)
			c.Set("role", role)
			if tokenScopes != nil {
				c.Set("access_token_id", 8)
				c.Set("access_token_scopes", tokenScopes)
			}
		}, middleware.RequirePermission(authz.ChannelWrite), UpdateChannel)
		payload := `{"id":` + strconv.Itoa(channel.Id) + `,` + fields + `}`
		req := httptest.NewRequest(http.MethodPut, "/channel", strings.NewReader(payload))
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		return recorder
	}
	allowed := request(`"name":"after","Used_Quota":99999,"balance":9999,"created_time":9999`)
	require.Contains(t, allowed.Body.String(), `"success":true`)
	stored, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "after", stored.Name)
	assert.EqualValues(t, 7654, stored.UsedQuota)
	assert.Equal(t, 12.5, stored.Balance)
	assert.EqualValues(t, 123, stored.CreatedTime)
	for _, fields := range []string{
		`"key":"replace-key"`, `"base_url":"https://leak.example"`,
		`"header_override":"{\"Authorization\":\"leak\"}"`,
		`"setting":"{\"proxy\":\"https://leak.example\"}"`,
		`"future_secret_field":"x"`, `"Status":2`,
	} {
		denied := request(fields)
		assert.Contains(t, denied.Body.String(), `"success":false`, fields)
	}
	role = common.RoleRootUser
	tokenScopes = []string{"channel:write"}
	assert.Contains(t, request(`"key":"replace-key"`).Body.String(), `"success":false`, "root PAT must respect its own scope ceiling")
	assert.Contains(t, request(`"name":"pat-routing"`).Body.String(), `"success":true`)
	tokenScopes = append(tokenScopes, "channel:sensitive_write")
	assert.Contains(t, request(`"key":"replace-key"`).Body.String(), `"success":true`)
	stored, err = model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "replace-key", stored.Key)
	assert.Equal(t, url, *stored.BaseURL)
}

func TestChannelTagOverridesRequireSensitiveGrant(t *testing.T) {
	setupTaskPluginBindChannelTest(t)
	router := gin.New()
	router.PUT("/channel/tag", func(c *gin.Context) {
		c.Set("id", 1)
		c.Set("role", common.RoleRootUser)
		c.Set("access_token_id", 8)
		c.Set("access_token_scopes", []string{"channel:write"})
		EditTagChannels(c)
	})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/channel/tag", strings.NewReader(`{"tag":"default","header_override":"{\"Authorization\":\"leak\"}"}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, req)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
}
