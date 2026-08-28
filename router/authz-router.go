package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// registerAuthzRoutes mounts the authorization API under its own /authz
// namespace. GET /authz/catalog returns the permission schema (resources,
// actions, and role baselines) used by the client permission editor.
func registerAuthzRoutes(apiRouter *gin.RouterGroup) {
	authzRoute := apiRouter.Group("/authz")
	authzRoute.Use(middleware.AdminAuth())
	{
		authzRoute.GET("/catalog", controller.GetPermissionCatalog)
		authzRoute.GET("/user/:id/permissions", controller.GetUserPermissions)
	}
	// Per-user permission overrides are a root-only capability.
	rootAuthzRoute := apiRouter.Group("/authz")
	rootAuthzRoute.Use(middleware.RootAuth())
	{
		rootAuthzRoute.PUT("/user/:id/permissions", controller.UpdateUserPermissions)
	}
}
