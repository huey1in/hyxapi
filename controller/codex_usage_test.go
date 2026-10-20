package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCodexCredentialValidationPreservesSingleJSON(t *testing.T) {
	valid := `{ "access_token": "token", "account_id": "account" }`
	channel := &model.Channel{Type: constant.ChannelTypeCodex, Key: valid}
	require.NoError(t, validateChannel(channel, true))
	for _, key := range []string{`null`, `[]`, `{"access_token":true,"account_id":"a"}`, `{"access_token":"a","account_id":12}`, `{"access_token":" ","account_id":"a"}`} {
		channel.Key = key
		require.Error(t, validateChannel(channel, true), key)
	}
	channel.Key = ""
	require.NoError(t, validateChannel(channel, false), "blank edit preserves the existing key")
	channel.Key = valid
	channel.ChannelInfo.IsMultiKey = true
	require.ErrorContains(t, validateChannel(channel, true), "multiple keys")
	for _, mode := range []string{"batch", "multi_to_single"} {
		body, err := json.Marshal(AddChannelRequest{Mode: mode, Channel: &model.Channel{Type: constant.ChannelTypeCodex, Key: valid}})
		require.NoError(t, err)
		router := gin.New()
		router.POST("/channel", AddChannel)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/channel", strings.NewReader(string(body))))
		require.Contains(t, recorder.Body.String(), "single creation")
	}
}

func TestCodexUsageAndResetForwardToConfiguredChannel(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	var paths []string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.Path)
		require.Equal(t, "Bearer fixture-token", r.Header.Get("Authorization"))
		require.Equal(t, "fixture-account", r.Header.Get("chatgpt-account-id"))
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			var body map[string]string
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.NotEmpty(t, body["redeem_request_id"])
		}
		_, _ = w.Write([]byte(`{"available_count":0,"rate_limit":{"allowed":true,"primary_window":{"used_percent":0}}}`))
	}))
	defer upstream.Close()
	url := upstream.URL
	channel := &model.Channel{Type: constant.ChannelTypeCodex, Key: `{"access_token":"fixture-token","account_id":"fixture-account"}`, BaseURL: &url}
	require.NoError(t, db.Create(channel).Error)
	router := gin.New()
	router.GET("/:id/usage", GetCodexChannelUsage)
	router.GET("/:id/credits", GetCodexChannelRateLimitResetCredits)
	router.POST("/:id/reset", ResetCodexChannelUsage)
	for _, request := range []struct{ method, path string }{{"GET", "usage"}, {"GET", "credits"}, {"POST", "reset"}} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(request.method, "/"+strconv.Itoa(channel.Id)+"/"+request.path, nil))
		require.Contains(t, recorder.Body.String(), `"success":true`)
		require.Contains(t, recorder.Body.String(), `"available_count":0`)
		require.NotContains(t, recorder.Body.String(), "fixture-token")
	}
	require.Equal(t, []string{"GET /backend-api/wham/usage", "GET /backend-api/wham/rate-limit-reset-credits", "POST /backend-api/wham/rate-limit-reset-credits/consume"}, paths)
}
