package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ticketError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorStatus(c, http.StatusNotFound, errors.New("Ticket not found"))
		return
	}
	if errors.Is(err, model.ErrTicketInvalid) {
		common.ApiErrorStatus(c, http.StatusBadRequest, err)
		return
	}
	common.ApiError(c, err)
}

func ListTickets(c *gin.Context) {
	listTickets(c, model.DB.Model(&model.Ticket{}).Where("user_id = ?", c.GetInt("id")), false)
}

func ListManagedTickets(c *gin.Context) {
	if c.GetInt("role") < common.RoleSupportUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	listTickets(c, model.TicketScope(model.DB.Model(&model.Ticket{}), c.GetInt("id"), c.GetInt("role")), true)
}

func listTickets(c *gin.Context, q *gorm.DB, management bool) {
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	if page < 1 {
		page = 1
	}
	if page > 100000 {
		page = 100000
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if management {
		switch c.Query("queue") {
		case "mine":
			q = q.Where("assignee_id = ?", c.GetInt("id"))
		case "unassigned":
			q = q.Where("assignee_id = 0")
		case "":
		default:
			ticketError(c, model.ErrTicketInvalid)
			return
		}
	}
	if keyword := []rune(c.Query("keyword")); len(keyword) != 0 {
		if len(keyword) > 160 {
			keyword = keyword[:160]
		}
		q = q.Where("subject LIKE ?", "%"+string(keyword)+"%")
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		ticketError(c, err)
		return
	}
	items := []model.Ticket{}
	if err := q.Order("updated_at DESC, id DESC").Limit(10).Offset((page - 1) * 10).Find(&items).Error; err != nil {
		ticketError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

func CreateTicket(c *gin.Context) {
	var req struct {
		Subject  string `json:"subject"`
		Category string `json:"category"`
		Body     string `json:"body"`
	}
	if c.ShouldBindJSON(&req) != nil {
		ticketError(c, model.ErrTicketInvalid)
		return
	}
	t, err := model.CreateTicket(c.GetInt("id"), req.Subject, req.Category, req.Body)
	if err != nil {
		ticketError(c, err)
		return
	}
	common.ApiSuccess(c, t)
}

func GetTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		ticketError(c, gorm.ErrRecordNotFound)
		return
	}
	var ticket model.Ticket
	if err := model.TicketScope(model.DB, c.GetInt("id"), c.GetInt("role")).First(&ticket, id).Error; err != nil {
		ticketError(c, err)
		return
	}
	q := model.DB.Where("ticket_id = ?", id)
	if !model.CanHandleTicket(&ticket, c.GetInt("id"), c.GetInt("role")) {
		q = q.Where("internal = ?", false)
	}
	if before, _ := strconv.Atoi(c.Query("before")); before > 0 {
		q = q.Where("id < ?", before)
	}
	messages := []model.TicketMessage{}
	if err := q.Order("id DESC").Limit(51).Find(&messages).Error; err != nil {
		ticketError(c, err)
		return
	}
	more := len(messages) > 50
	if more {
		messages = messages[:50]
	}
	common.ApiSuccess(c, gin.H{"ticket": ticket, "messages": messages, "has_more": more, "can_handle": model.CanHandleTicket(&ticket, c.GetInt("id"), c.GetInt("role"))})
}

func UpdateTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		ticketError(c, gorm.ErrRecordNotFound)
		return
	}
	var req model.TicketChange
	if c.ShouldBindJSON(&req) != nil {
		ticketError(c, model.ErrTicketInvalid)
		return
	}
	ticket, err := model.ChangeTicket(id, c.GetInt("id"), c.GetInt("role"), req)
	if err != nil {
		ticketError(c, err)
		return
	}
	if c.GetInt("role") >= common.RoleSupportUser {
		recordManageAuditFor(c, ticket.UserID, "ticket.update", map[string]any{"ticket_id": id, "status": ticket.Status, "assignee_id": ticket.AssigneeID, "internal": req.Internal})
	}
	common.ApiSuccess(c, ticket)
}

func TicketAgents(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}
	var agents []struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
	}
	if err := model.DB.Model(&model.User{}).Select("id, username").Where("role >= ? AND status = ?", common.RoleSupportUser, common.UserStatusEnabled).Order("id").Limit(1000).Scan(&agents).Error; err != nil {
		ticketError(c, err)
		return
	}
	common.ApiSuccess(c, agents)
}
