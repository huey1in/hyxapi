package model

import (
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSupportPaymentDB(t *testing.T) {
	t.Helper()
	previousDB, previousLogDB, previousRedis := DB, LOG_DB, common.RedisEnabled
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "support.db")+"?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_txlock=immediate"), &gorm.Config{})
	require.NoError(t, err)
	DB, LOG_DB, common.RedisEnabled = db, db, false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, db.AutoMigrate(&User{}, &Ticket{}, &TicketMessage{}, &TopUp{}, &USDTOrder{}, &Log{}))
	connection, err := db.DB()
	require.NoError(t, err)
	connection.SetMaxOpenConns(4)
	t.Cleanup(func() {
		DB, LOG_DB, common.RedisEnabled = previousDB, previousLogDB, previousRedis
		common.SetDatabaseTypes(previousMain, previousLog)
		_ = connection.Close()
	})
}

func TestTicketObjectPermissionsAndInternalNotes(t *testing.T) {
	setupSupportPaymentDB(t)
	for id, role := range map[int]int{1: 1, 2: 1, 3: 5, 4: 5, 5: 10, 6: 100} {
		require.NoError(t, DB.Create(&User{Id: id, Username: common.GetRandomString(10), AffCode: common.GetRandomString(20), Role: role, Status: common.UserStatusEnabled}).Error)
	}
	ticket, err := CreateTicket(1, "Payment question", "billing", "My payment is missing")
	require.NoError(t, err)
	var invisible Ticket
	require.ErrorIs(t, TicketScope(DB, 2, 1).First(&invisible, ticket.ID).Error, gorm.ErrRecordNotFound)
	_, err = ChangeTicket(ticket.ID, 2, 1, TicketChange{Body: "forged reply"})
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	_, err = ChangeTicket(ticket.ID, 1, 1, TicketChange{Internal: true, Body: "hidden"})
	require.ErrorIs(t, err, ErrTicketInvalid)
	_, err = ChangeTicket(ticket.ID, 3, 5, TicketChange{Body: "reply before claim"})
	require.ErrorIs(t, err, ErrTicketInvalid)
	_, err = ChangeTicket(ticket.ID, 3, 5, TicketChange{Claim: true})
	require.NoError(t, err)
	_, err = ChangeTicket(ticket.ID, 4, 5, TicketChange{Body: "other agent"})
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	_, err = ChangeTicket(ticket.ID, 3, 5, TicketChange{Internal: true, Body: "staff only"})
	require.NoError(t, err)
	_, err = ChangeTicket(ticket.ID, 3, 5, TicketChange{Body: "Please provide transaction ID"})
	require.NoError(t, err)
	var after Ticket
	require.NoError(t, DB.First(&after, ticket.ID).Error)
	require.Equal(t, "waiting_user", after.Status)
	_, err = ChangeTicket(ticket.ID, 1, 1, TicketChange{Body: "Here is my ID"})
	require.NoError(t, err)
	_, err = ChangeTicket(ticket.ID, 1, 1, TicketChange{Priority: "high"})
	require.ErrorIs(t, err, ErrTicketInvalid)
	other := 4
	_, err = ChangeTicket(ticket.ID, 3, 5, TicketChange{AssigneeID: &other})
	require.ErrorIs(t, err, ErrTicketInvalid)
	_, err = ChangeTicket(ticket.ID, 5, 10, TicketChange{AssigneeID: &other})
	require.NoError(t, err)
	_, err = ChangeTicket(ticket.ID, 3, 5, TicketChange{Body: "no longer assigned"})
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
	_, err = ChangeTicket(ticket.ID, 6, 100, TicketChange{Status: "closed"})
	require.NoError(t, err)
	_, err = ChangeTicket(ticket.ID, 1, 1, TicketChange{Body: "closed reply"})
	require.ErrorIs(t, err, ErrTicketInvalid)
	_, err = ChangeTicket(ticket.ID, 1, 1, TicketChange{Status: "open"})
	require.NoError(t, err)
}

func TestTicketScopeCannotEscapeThroughCombinedFilters(t *testing.T) {
	setupSupportPaymentDB(t)
	mine, err := CreateTicket(1, "Own", "other", "Body")
	require.NoError(t, err)
	other, err := CreateTicket(2, "Someone else's", "other", "Body")
	require.NoError(t, err)
	var rows []Ticket
	require.NoError(t, TicketScope(DB.Model(&Ticket{}), 1, 1).Where("id = ?", other.ID).Find(&rows).Error)
	require.Empty(t, rows)
	_, err = ChangeTicket(mine.ID, 1, 1, TicketChange{Body: strings.Repeat("x", 10001)})
	require.ErrorIs(t, err, ErrTicketInvalid)
	_, err = CreateTicket(1, strings.Repeat("x", 161), "other", "Body")
	require.ErrorIs(t, err, ErrTicketInvalid)
	_, err = CreateTicket(1, "Subject", "invalid", "Body")
	require.ErrorIs(t, err, ErrTicketInvalid)
}

func TestTicketConcurrentClaimHasSingleWinner(t *testing.T) {
	setupSupportPaymentDB(t)
	for _, id := range []int{3, 4} {
		require.NoError(t, DB.Create(&User{Id: id, Username: common.GetRandomString(10), AffCode: common.GetRandomString(20), Role: 5, Status: 1}).Error)
	}
	ticket, err := CreateTicket(1, "Claim race", "other", "Body")
	require.NoError(t, err)
	var wait sync.WaitGroup
	outcomes := make(chan error, 2)
	for _, id := range []int{3, 4} {
		wait.Add(1)
		go func(agent int) {
			defer wait.Done()
			_, err := ChangeTicket(ticket.ID, agent, 5, TicketChange{Claim: true})
			outcomes <- err
		}(id)
	}
	wait.Wait()
	close(outcomes)
	successes := 0
	for err := range outcomes {
		if err == nil {
			successes++
		}
	}
	require.Equal(t, 1, successes)
}
