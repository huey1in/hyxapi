package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service/authz"

	"github.com/gin-gonic/gin"
)

// GetPermissionCatalog returns the permission schema used by the client to
// render the permission editor: the registry of resources with their actions
// and display label keys, plus the roles with their baseline grant matrices.
// Defining it in the authz package keeps the schema in a single place.
func GetPermissionCatalog(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"resources": authz.Catalog(),
			"roles":     authz.Roles(),
		},
	})
}

// GetUserPermissions returns the effective permission matrix for a user,
// including the managed role baseline plus any per-user overrides.
func GetUserPermissions(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}
	common.ApiSuccess(c, gin.H{
		"permissions": authz.ExplicitUserPermissions(id),
		"overrides":   authz.ExplicitUserOverrides(id),
	})
}

type updatePermissionsRequest struct {
	Permissions map[string]map[string]bool `json:"permissions"`
}

// UpdateUserPermissions replaces a user's per-user permission overrides.
// Only the root role may update admin permissions.
func UpdateUserPermissions(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}
	var req updatePermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request")
		return
	}
	if err := authz.SetUserPermissions(id, req.Permissions); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

