package controller

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var allowedLogoExts = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".svg": true, ".ico": true, ".webp": true,
}

func UploadLogo(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请选择文件"})
		return
	}
	if file.Size > 2*1024*1024 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "文件大小不能超过 2MB"})
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedLogoExts[ext] {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "仅支持 png/jpg/svg/ico/webp 格式"})
		return
	}

	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "创建目录失败"})
		return
	}

	// Remove old logo files
	entries, _ := os.ReadDir(uploadDir)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), "logo.") {
			os.Remove(filepath.Join(uploadDir, e.Name()))
		}
	}

	filename := "logo" + ext
	savePath := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "保存文件失败"})
		return
	}

	logoURL := fmt.Sprintf("/uploads/%s", filename)
	common.Logo = logoURL
	model.UpdateOption("Logo", logoURL)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": logoURL})
}
