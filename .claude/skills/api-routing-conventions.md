# API 与路由开发规范

当你新增或修改 API 端点时，必须遵循以下规范。

---

## 1. 路由注册

### 文件位置
- 管理 API：`router/api-router.go`
- Relay API：`router/relay-router.go`
- Web 静态资源：`router/web-router.go`

### 路由分组模式
```go
// 按资源分组
channelRoute := apiRouter.Group("/channel")
channelRoute.Use(middleware.AdminAuth())
{
    channelRoute.GET("/", controller.GetAllChannels)
    channelRoute.GET("/:id", controller.GetChannel)
    channelRoute.POST("/", controller.CreateChannel)
    channelRoute.PUT("/", controller.UpdateChannel)
    channelRoute.DELETE("/:id", controller.DeleteChannel)
}
```

### 中间件应用顺序
1. `middleware.RouteTag("api")` — 路由标记
2. `gzip.Gzip()` — 压缩
3. `middleware.GlobalAPIRateLimit()` — 全局限流
4. 认证中间件（按需）：
   - `middleware.UserAuth()` — 普通用户
   - `middleware.AdminAuth()` — 管理员
   - `middleware.RootAuth()` — 超级管理员
   - `middleware.TokenAuth()` — API Token
5. 业务中间件（按需）：
   - `middleware.CriticalRateLimit()` — 关键操作限流
   - `middleware.TurnstileCheck()` — 人机验证
   - `middleware.SecureVerificationRequired()` — 二次验证

---

## 2. Controller 编写

### 标准 CRUD 模板

```go
// 列表（带分页）
func GetAllItems(c *gin.Context) {
    pageInfo := common.GetPageQuery(c)
    keyword := c.Query("keyword")
    
    items, total, err := model.GetItems(pageInfo.Page, pageInfo.PageSize, keyword)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": items, "total": total})
}

// 创建
func CreateItem(c *gin.Context) {
    var req dto.CreateItemRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的请求参数"})
        return
    }
    // 业务校验
    item, err := service.CreateItem(c, &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": item})
}

// 删除
func DeleteItem(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的 ID"})
        return
    }
    err = model.DeleteItemById(id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
```

### 获取当前用户信息
```go
userId := c.GetInt("id")
username := c.GetString("username")
role := c.GetInt("role")
group := c.GetString("group")
```

---

## 3. DTO 定义

### 文件组织
- 每个业务域一个目录：`dto/channel/`, `dto/user/`
- 或按 provider 分：`dto/openai/`, `dto/claude/`

### 命名规则
```go
// 请求
type CreateChannelRequest struct {
    Name   string `json:"name" binding:"required"`
    Type   int    `json:"type" binding:"required"`
    Key    string `json:"key" binding:"required"`
    Models string `json:"models"`
}

// 响应（如果与 model 不同）
type ChannelResponse struct {
    Id     int    `json:"id"`
    Name   string `json:"name"`
    Status int    `json:"status"`
    // Key 字段不暴露
}
```

### 校验
- 使用 `binding:"required"` 标记必填字段
- 复杂校验在 Service 层做，不在 DTO tag 中
- 敏感字段（Key、Password）在响应中脱敏或省略

---

## 4. 分页规范

### 请求参数
- `page` — 页码（从 1 开始）
- `page_size` — 每页条数（默认 20，最大 100）
- 通过 `common.GetPageQuery(c)` 统一解析

### 响应格式
```json
{
    "success": true,
    "data": [...],
    "total": 150
}
```

---

## 5. 限流策略

| 场景 | 中间件 | 默认限制 |
|------|--------|----------|
| 全局 API | `GlobalAPIRateLimit()` | 60 req/min |
| 关键操作（登录、注册） | `CriticalRateLimit()` | 10 req/min |
| 邮件验证 | `EmailVerificationRateLimit()` | 3 req/min |
| 下载 | `DownloadRateLimit()` | 10 req/min |
| 搜索 | `SearchRateLimit()` | 20 req/min |

新增 API 时根据操作敏感度选择合适的限流中间件。

---

## 6. Relay API 开发

### 新增 Provider 步骤
1. 在 `relay/channel/` 下创建 provider 目录
2. 实现 `Adaptor` 接口：
```go
type Adaptor interface {
    Init(info *relaycommon.RelayInfo)
    GetRequestURL(info *relaycommon.RelayInfo) (string, error)
    SetupRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error
    ConvertRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error)
    DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error)
    DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage *dto.Usage, err *types.NewAPIError)
}
```
3. 在 `relay/constant/` 注册 channel type 常量
4. 在 `relay/relay_adaptor.go` 的 switch 中注册

### Relay 错误处理
```go
// 使用 types.NewAPIError
return nil, &types.NewAPIError{
    StatusCode: resp.StatusCode,
    Type:       types.ErrorTypeUpstream,
    Message:    "upstream error: " + body,
}
```

---

## 7. 安全要求

### 认证
- 所有写操作必须有认证中间件
- 管理操作使用 `AdminAuth()` 或 `RootAuth()`
- Token API 使用 `TokenAuth()`

### 输入校验
- 路径参数 ID 必须 `strconv.Atoi` 并检查错误
- 字符串参数做长度限制
- JSON body 使用 `ShouldBindJSON` 自动校验

### 输出安全
- API Key 在列表接口中脱敏（`MaskTokenKey()`）
- 用户密码永远不返回
- 错误信息不暴露内部实现细节

---

## 8. 异步操作

对于耗时操作（通道测试、批量更新），使用异步模式：
```go
func TestAllChannels(c *gin.Context) {
    // 立即返回
    c.JSON(http.StatusOK, gin.H{"success": true, "message": "测试已开始"})
    
    // 异步执行
    gopool.Go(func() {
        service.TestAllChannels()
    })
}
```
