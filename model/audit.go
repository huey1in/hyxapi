package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

const (
	AuditCreate  = "create"
	AuditUpdate  = "update"
	AuditDelete  = "delete"
	AuditEnable  = "enable"
	AuditDisable = "disable"
)

// RecordResourceAudit records a successful resource mutation in the independent audit store.
func RecordResourceAudit(c *gin.Context, action, resourceType string, resourceID int, detail string) {
	authMethod := "session"
	if c.GetBool("use_access_token") {
		authMethod = "access_token"
	}
	action = resourceType + "." + action
	RecordOperationAuditLog(c.GetInt("id"), c.GetInt("role"), detail, c.ClientIP(), action,
		map[string]any{"resource_type": resourceType, "resource_id": resourceID},
		&AuditAdminInfo{AdminID: c.GetInt("id"), AdminUsername: c.GetString("username"), AdminRole: c.GetInt("role"), AuthMethod: authMethod},
		&AuditRequestInfo{Method: c.Request.Method, Route: c.FullPath(), Path: c.FullPath(), Status: c.Writer.Status(), Success: true}, c)
	common.SetContextKey(c, constant.ContextKeyAuditLogged, true)
}
