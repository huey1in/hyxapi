package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type UserOAuthBindingResponse struct {
	ProviderId     int    `json:"provider_id"`
	ProviderName   string `json:"provider_name"`
	ProviderSlug   string `json:"provider_slug"`
	ProviderIcon   string `json:"provider_icon"`
	ProviderUserId string `json:"provider_user_id"`
}

func buildUserOAuthBindingsResponse(userId int) ([]UserOAuthBindingResponse, error) {
	bindings, err := model.GetUserOAuthBindingsByUserId(userId)
	if err != nil {
		return nil, err
	}

	response := make([]UserOAuthBindingResponse, 0, len(bindings))
	for _, binding := range bindings {
		provider, err := model.GetCustomOAuthProviderById(binding.ProviderId)
		if err != nil {
			continue
		}
		response = append(response, UserOAuthBindingResponse{
			ProviderId:     binding.ProviderId,
			ProviderName:   provider.Name,
			ProviderSlug:   provider.Slug,
			ProviderIcon:   provider.Icon,
			ProviderUserId: binding.ProviderUserId,
		})
	}

	return response, nil
}

func GetUserOAuthBindingsByAdmin(c *gin.Context) {
	userIdStr := c.Param("id")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		common.ApiErrorMsg(c, "no permission")
		return
	}

	response, err := buildUserOAuthBindingsResponse(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    response,
	})
}

func UnbindCustomOAuthByAdmin(c *gin.Context) {
	userIdStr := c.Param("id")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		common.ApiErrorMsg(c, "no permission")
		return
	}

	providerIdStr := c.Param("provider_id")
	providerId, err := strconv.Atoi(providerIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid provider id")
		return
	}

	if err := model.DeleteUserOAuthBinding(userId, providerId); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "success",
	})
}
