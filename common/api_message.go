package common

import (
	"errors"
	"github.com/gin-gonic/gin"
	"maps"
	"net/http"
)

func ApiErrorStatus(c *gin.Context, status int, err error, fields ...gin.H) {
	body := gin.H{
		"success": false,
		"message": err.Error(),
	}
	var message *Message
	if errors.As(err, &message) {
		maps.Copy(body, message.Fields())
	}
	for _, extra := range fields {
		maps.Copy(body, extra)
	}
	c.JSON(status, body)
}

func ApiErrorT(c *gin.Context, key string, params ...map[string]any) {
	ApiError(c, NewMessage(key, params...))
}

func ApiSuccessT(c *gin.Context, key string, data any, params ...map[string]any) {
	message := NewMessage(key, params...)
	body := gin.H{
		"success": true,
		"message": message.Error(),
		"data":    data,
	}
	maps.Copy(body, message.Fields())
	c.JSON(http.StatusOK, body)
}
