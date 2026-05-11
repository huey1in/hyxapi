# Go 后端开发规范

当你在本项目中编写或修改 Go 后端代码时，必须遵循以下规范。

---

## 1. 项目结构

```
controller/    → HTTP 请求处理（参数校验、调用 service、返回响应）
service/       → 业务逻辑（不直接操作 gin.Context）
model/         → 数据模型 + 数据库操作（GORM）
relay/         → API 代理层（上游 provider 适配）
middleware/    → HTTP 中间件
dto/           → 请求/响应数据传输对象
common/        → 工具函数（无业务逻辑）
constant/      → 全局常量（无函数、无业务逻辑）
setting/       → 运行时配置管理
pkg/           → 可复用的独立包（无项目依赖）
types/         → 类型定义
```

### 层级调用规则
- Controller → Service → Model（单向依赖）
- Controller 不直接调用 Model 的写操作
- Service 之间可以互相调用
- Model 层只做数据存取，不含业务判断
- `common/` 和 `constant/` 可被任何层引用

---

## 2. 命名规范

### 文件命名
- 小写 + 下划线：`channel_cache.go`, `user_notify.go`
- 测试文件：`channel_cache_test.go`
- 按功能域拆分，单文件不超过 500 行

### 变量/函数命名
- 导出函数：PascalCase — `GetAllChannels`, `DisableChannel`
- 私有函数：camelCase — `parseStatusFilter`, `formatNotifyType`
- 常量：PascalCase — `ChannelStatusEnabled`, `RoleAdminUser`
- 缩写保持一致大小写：`ID`, `URL`, `HTTP`, `API`（不是 `Id`, `Url`）

### 包命名
- 单个小写单词：`model`, `service`, `relay`
- 避免 `utils`, `helpers`, `misc`（用 `common` 代替）

---

## 3. 错误处理

### Controller 层
```go
func CreateChannel(c *gin.Context) {
    var req dto.CreateChannelRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的请求参数"})
        return
    }
    // 调用 service
    channel, err := service.CreateChannel(&req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": channel})
}
```

### Service 层
- 返回 `error` 或自定义错误类型
- 使用 `fmt.Errorf("context: %w", err)` 包装错误
- 不要吞掉错误，不要 `log.Fatal`

### 统一响应格式
```go
// 成功
gin.H{"success": true, "message": "", "data": ...}

// 失败
gin.H{"success": false, "message": "错误描述"}

// 分页
gin.H{"success": true, "message": "", "data": items, "total": total}
```

---

## 4. 数据库操作

### Model 定义
```go
type Channel struct {
    Id          int    `json:"id"`
    Name        string `json:"name" gorm:"index"`
    Status      int    `json:"status" gorm:"default:1"`
    CreatedTime int64  `json:"created_time" gorm:"bigint"`
}
```

### 查询模式
```go
// 分页查询
func GetChannels(page, pageSize int) ([]*Channel, int64, error) {
    var channels []*Channel
    var total int64
    tx := DB.Model(&Channel{})
    tx.Count(&total)
    err := tx.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&channels).Error
    return channels, total, err
}

// 条件更新
func UpdateChannelStatus(id int, status int) error {
    return DB.Model(&Channel{}).Where("id = ?", id).Update("status", status).Error
}
```

### 规则
- 使用 `?` 占位符防止 SQL 注入，禁止字符串拼接
- 批量操作使用事务：`DB.Transaction(func(tx *gorm.DB) error { ... })`
- 大批量写入使用 `CreateInBatches`
- 查询必须有 `Limit`，禁止无限制全表扫描
- 时间字段统一用 Unix 时间戳（int64）

---

## 5. 并发模式

### 异步任务
```go
// 使用 gopool 而非裸 goroutine
gopool.Go(func() {
    // 异步操作
})
```

### 原子操作
```go
// 计数器使用 atomic
var activeConnections int64
atomic.AddInt64(&activeConnections, 1)
```

### 缓存同步
- 读多写少：`sync.RWMutex`
- 简单计数：`atomic`
- 并发 map：`sync.Map`（仅当 key 集合稳定时）

---

## 6. 配置管理

### 环境变量
- 通过 `os.Getenv()` 读取，在 `common/env.go` 中统一初始化
- 布尔值：`os.Getenv("X") == "true"`
- 数值：`strconv.Atoi(os.Getenv("X"))`

### 运行时配置
- 存储在数据库 `options` 表
- 通过 `model.SyncOptions()` 定期同步到内存
- 通过 `setting/` 包访问

---

## 7. 日志规范

```go
common.SysLog("message")           // 系统信息
common.SysError("error message")   // 系统错误
logger.LogInfo(ctx, "message")     // 带 request ID 的信息
logger.LogError(ctx, "message")    // 带 request ID 的错误
```

- 日志中包含关键上下文：channel ID、user ID、model name
- 敏感信息使用 `common.MaskSensitiveInfo()` 脱敏
- 禁止在日志中输出完整 API key 或用户密码

---

## 8. 中间件编写

```go
func MyMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 前置逻辑
        c.Next()
        // 后置逻辑
    }
}
```

- 中间件放在 `middleware/` 包
- 通过 `c.Set(key, value)` / `c.Get(key)` 传递上下文数据
- 认证信息通过 `c.Set("id", userId)` 传递
- 中间件不做业务逻辑，只做横切关注点

---

## 9. 依赖注入

本项目使用包级变量 + init 模式，不使用 DI 框架：
```go
// model/main.go
var DB *gorm.DB

func InitDB() error {
    DB = ...
}
```

新增全局资源时在 `main.go` 的 `InitResources()` 中初始化。

---

## 10. 测试规范

```go
func TestShouldDisableChannel(t *testing.T) {
    tests := []struct {
        name     string
        err      *types.NewAPIError
        expected bool
    }{
        {"nil error", nil, false},
        {"channel error", &types.NewAPIError{Type: types.ErrorTypeChannel}, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := ShouldDisableChannel(tt.err)
            if result != tt.expected {
                t.Errorf("got %v, want %v", result, tt.expected)
            }
        })
    }
}
```

- 使用 table-driven tests
- 测试文件与源文件同目录
- Mock 外部依赖，不 mock 数据库（集成测试用真实 DB）
- 测试函数命名：`Test<FunctionName>_<Scenario>`
