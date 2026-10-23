# 开发与测试

## 环境与模块

根模块和 TokenKit 要求 Go 1.26，RelayKit 要求 Go 1.25.1；开发整个仓库统一使用 Go 1.26 或更高版本。前端使用 Node.js 22.12 或更高版本及 Bun，配置见 [web/README.md](../web/README.md)。

首次检出后，先在 `web/` 执行 `bun install --frozen-lockfile` 和 `bun run build`。根模块嵌入 `web/dist/`，缺少产物时无法编译或测试。

## Go 验证

从仓库根目录依次执行：

```sh
go test ./...
cd relaykit
go test ./...
cd ../tokenkit
go test ./...
cd ..
go build -o hyxapi .
```

Windows 编译时使用 `go build -o hyxapi.exe .`。根模块测试不会遍历嵌套模块；RelayKit 和 TokenKit 必须保持独立可构建。协议转换的 golden 输出变更须人工核对，更新方式见 [RelayKit](../relaykit/README.md#开发)。

## 前端验证

在 `web/` 执行：

```sh
bun run test
bun run build
```

`test` 通过 Node 测试运行器执行全部 `*.test.js`；`build` 包含 TypeScript 检查和 Rsbuild 编译。仅检查类型可执行 `bun run typecheck`。定向执行测试时，从根目录运行，例如：

```sh
node --test web/src/pages/Token/token-management.test.js
```

组件预览使用 `bun run storybook`，静态预览构建使用 `bun run build-storybook`。

## Redis 集成测试

未设置 `REDIS_TEST_ADDR` 时，依赖真实 Redis 的测试会跳过。使用独立测试实例，测试会操作数据库 13、14，禁止指向业务 Redis。PowerShell 示例：

```powershell
$env:REDIS_TEST_ADDR = '127.0.0.1:16389'
go test ./middleware ./service -run 'Test(GroupRateLimitsRedisIntegration|LogExport)' -count=1
Remove-Item Env:REDIS_TEST_ADDR
```

实际支付、外部供应商和多节点部署需另做环境联调，本地模拟测试只验证对应代码行为。

## 修改约定

Go 代码运行 `gofmt`；前端遵循相邻代码的缩进和命名。计费、认证、权限及协议变更应覆盖回归场景。提交前执行 `git diff --check`，不要提交 `.env`、数据库、日志或构建产物。
