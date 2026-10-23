# 渠道设置

在“渠道管理 → 新建 / 编辑渠道”中配置。基础结构定义于 [`relaykit/dto/channel_settings.go`](../../relaykit/dto/channel_settings.go)，序列化为渠道对象的 `setting` 字段；模型、分组和供应商专属设置使用各自字段。

## 请求与连接选项

| 配置键 | 用途 |
| --- | --- |
| `force_format` | 将上游响应重新序列化为标准 OpenAI 格式，具体行为由渠道适配器决定 |
| `thinking_to_content` | 将 `reasoning_content` 以 `<think>` 内容返回 |
| `proxy` | 此渠道使用的 HTTP、HTTPS 或 SOCKS5 代理地址，留空不指定代理 |
| `pass_through_body_enabled` | 启用请求体透传，按渠道支持情况使用 |
| `responses_websocket_enabled` | 为支持的渠道启用 Responses WebSocket |
| `http_protocol` | `auto` 自动协商，`http1` 强制 HTTP/1.1；留空等同 `auto` |
| `http2_connection_shards` | HTTP/2 连接分片，范围 1–8；留空或 0 按 1 处理，HTTP/1.1 下忽略 |
| `tls_insecure_skip_verify` | 仅此渠道跳过上游 TLS 证书验证，默认关闭 |

这些选项由后台表单编辑，无需手工拼接 JSON。对接管理接口时，`setting` 是 JSON 字符串；其解码后的内容示例如下：

```json
{
  "force_format": false,
  "thinking_to_content": true,
  "proxy": "socks5://127.0.0.1:1080",
  "http_protocol": "auto",
  "http2_connection_shards": 2
}
```

上游凭据、代理地址和 TLS 设置只由获授权的管理员维护。修改连接配置后，服务会退役对应的旧连接，后续请求使用新配置。任务插件绑定和高级自定义路由应通过对应的可视化配置入口编辑。
