# 文档目录

从[项目说明](../README.md)开始。本目录维护当前实现的使用与开发说明；实施过程和变更历史通过 Git 查询。

## 部署与运维

- [原生部署](installation/native.md)：不使用容器的启动、初始化、备份和更新。
- [宝塔面板部署](installation/BT.md)：从本仓库构建镜像并配置反向代理。
- [功能与配置](configuration.md)：渠道、令牌、日志、下载与连接设置。
- [工单与自托管 USDT 收款](support-and-usdt.md)：角色权限、网关配置及回调验收。
- [环境变量示例](../.env.example)：后端配置项；[前端环境变量](../web/.env.example)用于构建和开发。

## 开发参考

- [开发与测试](development.md)：三个 Go 模块、前端和 Redis 集成测试。
- [前端开发](../web/README.md)：构建命令、类型检查与资源约定。
- [渠道设置](channel/settings.md)：请求格式、代理和连接选项。
- [计费表达式](../pkg/billingexpr/expr.md)：变量、请求规则、任务用量及结算链路。
- [RelayKit](../relaykit/README.md)：协议转换、流式状态和诊断。
- [TokenKit](../tokenkit/README.md)：文本与图片 Token 估算。
- [常量组织](../constant/README.md)：渠道、协议和上下文常量。
- [翻译指南与术语](translation-glossary.md)：中文、英文、法文和俄文术语。
- [接口说明](openapi/README.md)：管理与模型转发的 OpenAPI 文件。

## 维护约定

功能变更时同步更新对应说明，核对命令、配置键及源码路径。临时计划、测试流水和生成产物不纳入长期文档；避免在多个文件重复维护同一操作步骤。许可证和版权声明单独保留。
