# TokenKit

TokenKit 是仓库内独立的 Go 模块，用于文本 Token 计数及图片 Token 估算。它不下载媒体、不解析 HTTP 请求、不负责计费，也不依赖主模块、RelayKit、Gin 或数据库。

## 接入

要求 Go 1.26 或更高版本。HyxAPI 根模块已通过 `replace` 引用本目录。其他项目使用本仓库版本时，在自己的 `go.mod` 中配置本地路径，例如：

```go
require github.com/QuantumNous/new-api/tokenkit v0.0.0

replace github.com/QuantumNous/new-api/tokenkit => ../api/tokenkit
```

将替换路径调整为实际检出位置，避免下载到与本仓库实现不同的上游版本。

## 快速开始

```go
package main

import (
	"fmt"

	"github.com/QuantumNous/new-api/tokenkit"
)

func main() {
	text := "Explain the initialization flow."
	fmt.Println(tokenkit.Count("gpt-4o", text))
	fmt.Println(tokenkit.Estimate("claude-haiku-4-5", text))

	image := tokenkit.Image{Width: 1920, Height: 1080, Detail: "low"}
	fmt.Println(tokenkit.ImageTokens("gpt-4o", image))
}
```

## 文本计数

| API | 行为 |
| --- | --- |
| `Count(model, text)` | OpenAI GPT / o 系列使用 tiktoken；其他模型估算 |
| `Estimate(model, text)` | 始终按字符类别和模型家族权重估算 |
| `EstimateFamily(family, text)` | 直接指定估算家族 |
| `ModelFamily(model)` | 按名称识别家族，忽略大小写，支持厂商前缀和日期后缀 |

当前家族为 `FamilyOpenAI`、`FamilyClaude`、`FamilyClaude47`、`FamilyGemini` 和 `FamilyUnknown`。Claude 4.7 及以后或无法识别版本的 Claude 名称归入 `FamilyClaude47`；未知模型使用通用权重。

计数不代表完整请求的最终上游用量，调用方仍需考虑消息结构、工具和媒体。短文本、未知模型、超长连续片段及 tokenizer 差异可能产生误差；实际结算应优先使用上游返回的有效用量。

## 图片估算

`ImageTokens(model, Image)` 返回单张输入图片的估算值。`ImageNeedsSize(model, detail)` 用于判断是否需要解析尺寸。宽或高不大于 0 时按 1024×1024 估算；调用方负责提供可信尺寸。

当前 [`image.go`](image.go) 的实现按模型采用 patch、tile 或固定分辨率规则：

- OpenAI 根据模型与 `low`、`high`、`auto`、`original` 选择规则。
- Claude 使用两个版本分组对应的尺寸和 patch 上限。
- Gemini 3 使用 `MEDIA_RESOLUTION_LOW` 等分辨率档位，Gemini 2.x 使用尺寸切块。
- 未知模型每张按 520 Token 估算；超大尺寸有缩放和 patch 上限保护。

这些是本地实现规则，模型或供应商调整后需要更新，不能视为供应商报价或精度承诺。

## 开发与验证

在 `tokenkit/` 目录执行：

```sh
go test ./...
go build ./...
```

文本行为由 [`tokenkit_test.go`](tokenkit_test.go) 覆盖，图片规则由 [`image_test.go`](image_test.go) 覆盖。修改规则时补充边界用例；有条件时用相同请求带图与不带图的上游用量差验证，再记录可复现的模型和参数。

## 许可证

本模块遵循根目录中的 [GNU Affero General Public License v3.0](../LICENSE)，来源与版权声明见 [NOTICE](../NOTICE)。
