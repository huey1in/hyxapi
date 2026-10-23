package model

import (
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Ticket struct {
	ID         int    `json:"id"`
	UserID     int    `json:"user_id" gorm:"index"`
	Subject    string `json:"subject" gorm:"type:varchar(160)"`
	Category   string `json:"category" gorm:"type:varchar(32)"`
	Priority   string `json:"priority" gorm:"type:varchar(16)"`
	Status     string `json:"status" gorm:"type:varchar(24);index"`
	AssigneeID int    `json:"assignee_id" gorm:"index"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime:false"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime:false;index"`
	Revision   int    `json:"-"`
}

type TicketMessage struct {
	ID         int    `json:"id"`
	TicketID   int    `json:"ticket_id" gorm:"index"`
	AuthorID   int    `json:"author_id"`
	AuthorRole int    `json:"author_role"`
	Body       string `json:"body" gorm:"type:text"`
	Internal   bool   `json:"internal"`
	Kind       string `json:"kind" gorm:"type:varchar(16)"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime:false"`
}

var ErrTicketInvalid = errors.New("Invalid ticket parameters")

// Scope the SQL query itself; inaccessible IDs deliberately look nonexistent.
func TicketScope(db *gorm.DB, userID, role int) *gorm.DB {
	if role >= common.RoleAdminUser {
		return db
	}
	if role == common.RoleSupportUser {
		return db.Where("(user_id = ? OR assignee_id = ? OR assignee_id = 0)", userID, userID)
	}
	return db.Where("user_id = ?", userID)
}

func CanHandleTicket(t *Ticket, userID, role int) bool {
	return role >= common.RoleAdminUser || role == common.RoleSupportUser && t.AssigneeID == userID && t.UserID != userID
}

func validTicketText(value string, limit int) bool {
	return strings.TrimSpace(value) != "" && utf8.RuneCountInString(value) <= limit
}

func CreateTicket(userID int, subject, category, body string) (*Ticket, error) {
	subject, body = strings.TrimSpace(subject), strings.TrimSpace(body)
	if !validTicketText(subject, 160) || !validTicketText(body, 10000) || !ticketCategory(category) {
		return nil, ErrTicketInvalid
	}
	t := &Ticket{UserID: userID, Subject: subject, Category: category, Priority: "normal", Status: "open", CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp()}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(t).Error; err != nil {
			return err
		}
		return tx.Create(&TicketMessage{TicketID: t.ID, AuthorID: userID, AuthorRole: common.RoleCommonUser, Body: body, Kind: "message", CreatedAt: t.CreatedAt}).Error
	})
	return t, err
}

func ticketCategory(value string) bool {
	return value == "account" || value == "billing" || value == "api" || value == "other"
}

type TicketChange struct {
	Body       string `json:"body"`
	Internal   bool   `json:"internal"`
	Status     string `json:"status"`
	Priority   string `json:"priority"`
	AssigneeID *int   `json:"assignee_id"`
	Claim      bool   `json:"claim"`
}

func ChangeTicket(id, userID, role int, change TicketChange) (*Ticket, error) {
	t := &Ticket{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := TicketScope(lockForUpdate(tx), userID, role).First(t, id).Error; err != nil {
			return err
		}
		staff := CanHandleTicket(t, userID, role)
		revision := t.Revision
		owner := t.UserID == userID
		if change.Claim {
			if role != common.RoleSupportUser && role < common.RoleAdminUser || t.AssigneeID != 0 || owner {
				return ErrTicketInvalid
			}
			change.AssigneeID = &userID
		}
		if change.AssigneeID != nil {
			if role < common.RoleAdminUser && !change.Claim {
				return ErrTicketInvalid
			}
			if *change.AssigneeID != 0 {
				var agent User
				if err := tx.Where("id = ? AND role >= ? AND status = ?", *change.AssigneeID, common.RoleSupportUser, common.UserStatusEnabled).First(&agent).Error; err != nil {
					return ErrTicketInvalid
				}
				if agent.Id == t.UserID {
					return ErrTicketInvalid
				}
			}
			t.AssigneeID = *change.AssigneeID
			staff = CanHandleTicket(t, userID, role)
		}
		if change.Priority != "" {
			if !staff || (change.Priority != "low" && change.Priority != "normal" && change.Priority != "high") {
				return ErrTicketInvalid
			}
			t.Priority = change.Priority
		}
		body := strings.TrimSpace(change.Body)
		if change.Internal && !staff {
			return ErrTicketInvalid
		}
		if body != "" {
			if !validTicketText(body, 10000) || (!owner && !staff) || t.Status == "closed" {
				return ErrTicketInvalid
			}
			if err := tx.Create(&TicketMessage{TicketID: id, AuthorID: userID, AuthorRole: role, Body: body, Internal: change.Internal, Kind: "message", CreatedAt: common.GetTimestamp()}).Error; err != nil {
				return err
			}
			if !change.Internal {
				if staff {
					t.Status = "waiting_user"
				} else {
					t.Status = "open"
				}
			}
		}
		if change.Status != "" {
			if !staff && !owner {
				return ErrTicketInvalid
			}
			if change.Status != "open" && change.Status != "waiting_user" && change.Status != "resolved" && change.Status != "closed" {
				return ErrTicketInvalid
			}
			if !staff && change.Status != "closed" && change.Status != "open" {
				return ErrTicketInvalid
			}
			t.Status = change.Status
		}
		if body == "" && change.Status == "" && change.Priority == "" && change.AssigneeID == nil {
			return ErrTicketInvalid
		}
		if change.Status != "" || change.Priority != "" || change.AssigneeID != nil {
			// The history is part of the same transaction as the state change.
			if err := tx.Create(&TicketMessage{TicketID: id, AuthorID: userID, AuthorRole: role, Body: ticketChangeSummary(t), Kind: "event", CreatedAt: common.GetTimestamp()}).Error; err != nil {
				return err
			}
		}
		t.UpdatedAt = common.GetTimestamp()
		t.Revision++
		result := tx.Model(&Ticket{}).Where("id = ? AND revision = ?", t.ID, revision).Select("status", "priority", "assignee_id", "updated_at", "revision").Updates(t)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("Ticket changed. Refresh and try again")
		}
		return nil
	})
	return t, err
}

func ticketChangeSummary(t *Ticket) string {
	// Machine-readable event data is localized by the client.
	data, _ := json.Marshal(map[string]any{"status": t.Status, "priority": t.Priority, "assignee_id": t.AssigneeID})
	return string(data)
}
