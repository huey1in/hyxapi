package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTicketDetailsHideInternalMessagesAndOtherUsers(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Ticket{}, &model.TicketMessage{}))
	ticket, err := model.CreateTicket(user.Id, "API request failed", "api", "Help please")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.TicketMessage{TicketID: ticket.ID, AuthorID: user.Id + 10, AuthorRole: 5, Body: "private staff note", Internal: true, Kind: "message"}).Error)
	get := func(id, role int) *httptest.ResponseRecorder {
		return securityEnrollmentRequest("GET", "/api/tickets/1", "", "", identity, func(c *gin.Context) {
			c.Set("id", id)
			c.Set("role", role)
			c.Params = gin.Params{{Key: "id", Value: common.Interface2String(ticket.ID)}}
			GetTicket(c)
		})
	}
	response := get(user.Id, 1)
	require.Equal(t, http.StatusOK, response.Code)
	require.NotContains(t, response.Body.String(), "private staff note")
	require.Contains(t, response.Body.String(), "Help please")
	require.Equal(t, http.StatusNotFound, get(user.Id+1, 1).Code)
	require.NotContains(t, get(user.Id+2, 5).Body.String(), "private staff note")
	response = get(user.Id+3, 10)
	require.Contains(t, response.Body.String(), "private staff note")
}

func TestTicketListKeepsOwnershipPaginationAndUnicodeSearch(t *testing.T) {
	user, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Ticket{}, &model.TicketMessage{}))
	subject := strings.Repeat("\u6d4b", 160)
	for i := 0; i < 11; i++ {
		title := fmt.Sprintf("Question %d", i)
		if i == 0 {
			title = subject
		}
		_, err := model.CreateTicket(user.Id, title, "other", "Body")
		require.NoError(t, err)
	}
	_, err := model.CreateTicket(user.Id+1, subject, "other", "Private body")
	require.NoError(t, err)
	list := func(query string) (int64, []model.Ticket) {
		response := securityEnrollmentRequest("GET", "/api/tickets?"+query, "", "", identity, func(c *gin.Context) {
			c.Set("role", common.RoleCommonUser)
			ListTickets(c)
		})
		require.Equal(t, http.StatusOK, response.Code)
		var reply struct {
			Success bool `json:"success"`
			Data    struct {
				Total int64          `json:"total"`
				Items []model.Ticket `json:"items"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &reply))
		require.True(t, reply.Success, response.Body.String())
		for _, ticket := range reply.Data.Items {
			require.Equal(t, user.Id, ticket.UserID)
		}
		return reply.Data.Total, reply.Data.Items
	}
	total, rows := list("p=1")
	require.EqualValues(t, 11, total)
	require.Len(t, rows, 10)
	total, rows = list("p=2")
	require.EqualValues(t, 11, total)
	require.Len(t, rows, 1)
	total, rows = list("keyword=" + url.QueryEscape(subject+"x"))
	require.EqualValues(t, 1, total)
	require.Len(t, rows, 1)
	require.Equal(t, subject, rows[0].Subject)
}
