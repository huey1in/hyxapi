# 翻译指南与术语

前端译文位于 `web/src/i18n/locales/*.json`，由 `web/src/i18n/i18n.js` 注册；后端消息位于 `i18n/locales/*.yaml`。新增语言时同步语言注册与别名配置，不要只增加一个翻译文件。

## 统一术语

| 中文 | English | Français | Русский |
| --- | --- | --- | --- |
| API 密钥 | API Key | Clé API | API ключ |
| 访问令牌 | Access Token | Jeton d’accès | Токен доступа |
| Token 用量 | Token Usage | Utilisation des jetons | Использование токенов |
| 渠道 | Channel | Canal | Канал |
| 供应商 | Provider / Vendor | Fournisseur | Поставщик |
| 分组 | Group | Groupe | Группа |
| 额度 | Quota | Quota | Квота |
| 倍率 | Ratio | Ratio | Коэффициент |
| 输入 | Input | Entrée | Ввод |
| 输出 | Output | Sortie | Вывод |
| 提示 | Prompt | Invite | Промпт |
| 补全 | Completion | Complétion | Вывод |
| 输入价格 | Input Price | Prix d’entrée | Цена ввода |
| 输出价格 | Output Price | Prix de sortie | Цена вывода |
| 缓存读取 | Cache Read | Lecture du cache | Чтение кэша |
| 缓存写入 | Cache Write | Écriture du cache | Запись в кэш |
| 按量计费 | Pay-as-you-go | Paiement à l’utilisation | Оплата по объёму |
| 按次计费 | Per-request Billing | Paiement par appel | Оплата за запрос |
| 超级管理员 | Super Administrator | Super-administrateur | Суперадминистратор |
| 管理员 | Administrator | Administrateur | Администратор |
| 客服 | Support Agent | Agent d’assistance | Сотрудник поддержки |
| 普通用户 | User | Utilisateur | Пользователь |
| 工单 | Ticket | Ticket d’assistance | Обращение в поддержку |
| 充值 | Top Up | Recharge | Пополнение |
| 兑换码 | Redemption Code | Code d’échange | Код купона |
| 优先级 | Priority | Priorité | Приоритет |
| 权重 | Weight | Poids | Вес |
| 代理 | Proxy | Proxy | Прокси |
| 模型映射 | Model Mapping | Correspondance des modèles | Сопоставление моделей |
| 双重身份验证 | Two-Factor Authentication | Authentification à deux facteurs | Двухфакторная аутентификация |

API Key、个人访问令牌和模型处理的 Token 是不同概念，依据使用场景翻译。价格使用 Input / Output，模型交互使用 Prompt / Completion；按次计费不要译为视频观看语义的 Pay-per-view。

## 翻译约定

- 保留 `{{name}}`、格式占位符、HTML 标签和链接结构，不翻译配置键、协议字段及模型标识。
- 金额单位和每百万 Token、每千次调用等计价单位必须与源码一致；额度与货币金额按具体上下文区分。
- 同一功能使用统一译名。修改中文键时检查所有前端语言文件，后端消息 ID 保持稳定。
- 法文使用 Complétion 表示模型补全，注意阴阳性、单复数与标点空格；常用 API 等技术缩写保留。
- 俄文使用 Вывод 表示模型输出，注意格变化及 `_one`、`_few`、`_many`、`_other` 等复数形式。
- 只在源码已使用时保留表情或技术缩写，避免添加无助于理解的装饰。
