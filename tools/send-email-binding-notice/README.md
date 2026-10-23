# 邮箱绑定通知

通过 `common.SendEmail` 发送，从 PostgreSQL 的 `options` 表只读加载站点地址、当前保存的 `EmailTemplatePasswordReset` 和现有 SMTP 配置。保留当前邮件模板的白底、渐变卡片、按钮和 Outlook 兼容布局，仅替换通知文案及绑定链接，向一个指定邮箱发送通知。正文要求收到邮件后 24 小时内完成账号邮箱绑定，逾期未绑定将被封禁。

每次运行都读取数据库里的当前模板，不使用内置的旧版邮件外壳，也不修改正常验证码或密码重置邮件的配置。配置模板为空或结构不兼容时直接报错，避免回退到其他样式。

从仓库根目录运行，需要 Go 1.26 及以上版本，并通过环境变量设置可访问的 `SQL_DSN`：

```sh
go run ./tools/send-email-binding-notice --to recipient@example.com --preview /tmp/email-binding-notice.html
go run ./tools/send-email-binding-notice --to recipient@example.com
```

传入 `--preview` 只生成 HTML；不传入时发送一次邮件，不自动重试。`smtp_accepted` 表示邮件服务器已接受，不代表收件人已经阅读或邮件已进入收件箱。发送失败时先检查服务商的投递记录，避免重复发送。

此脚本只负责通知，不修改用户绑定状态，也不创建自动封禁任务。数据库连接和 SMTP 密码通过运行环境及数据库读取，不写入脚本或日志。
