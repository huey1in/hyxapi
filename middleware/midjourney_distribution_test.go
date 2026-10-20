package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestMidjourneyReadRoutesDoNotRequireASelectedChannel(t *testing.T) {
	for _, tc := range []struct{ method, path, route, body string }{
		{http.MethodGet, "/mj/task/owned-task/fetch", "/mj/task/:id/fetch", ""},
		{http.MethodGet, "/fast/mj/task/owned-task/image-seed", "/:mode/mj/task/:id/image-seed", ""},
		{http.MethodPost, "/mj/task/list-by-condition", "/mj/task/list-by-condition", `{"ids":["owned-task"]}`},
	} {
		t.Run(tc.path, func(t *testing.T) {
			engine := gin.New()
			engine.Handle(tc.method, tc.route, Distribute(), func(c *gin.Context) {
				require.Equal(t, 0, c.GetInt("channel_id"))
				c.JSON(http.StatusOK, gin.H{"reached_owner_checked_task_handler": true})
			})
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			request.Header.Set("Content-Type", "application/json")
			engine.ServeHTTP(recorder, request)
			require.Equal(t, http.StatusOK, recorder.Code)
			require.JSONEq(t, `{"reached_owner_checked_task_handler":true}`, recorder.Body.String())
		})
	}
}
