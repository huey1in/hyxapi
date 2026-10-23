// Command send-email-binding-notice sends one account email-binding notice using
// the currently configured email template and SMTP options in PostgreSQL.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"html"
	"net/mail"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	_ "github.com/jackc/pgx/v5/stdlib"
	xhtml "golang.org/x/net/html"
)

func recipientAddress(value string) (string, error) {
	if strings.ContainsAny(value, "\r\n") {
		return "", errors.New("recipient must be one email address")
	}
	address, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil || !strings.Contains(address.Address, "@") {
		return "", errors.New("recipient must be one email address")
	}
	return address.Address, nil
}

func nodeText(node *xhtml.Node) string {
	if node.Type == xhtml.TextNode {
		return node.Data
	}
	var text strings.Builder
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		text.WriteString(nodeText(child))
	}
	return text.String()
}

func setNodeText(node *xhtml.Node, value string) {
	for node.FirstChild != nil {
		node.RemoveChild(node.FirstChild)
	}
	node.AppendChild(&xhtml.Node{Type: xhtml.TextNode, Data: value})
}

func renderNotice(siteAddress, configuredTemplate string) (string, string, error) {
	site, err := url.Parse(strings.TrimSpace(siteAddress))
	if err != nil || (site.Scheme != "https" && site.Scheme != "http") || site.Host == "" || site.User != nil {
		return "", "", errors.New("ServerAddress must be an HTTP or HTTPS site URL without credentials")
	}
	site.Path, site.RawPath = "/personal", ""
	site.RawQuery, site.Fragment = "tab=account", ""
	if strings.TrimSpace(configuredTemplate) == "" {
		return "", "", errors.New("configure EmailTemplatePasswordReset before sending; no built-in template fallback is used")
	}
	if !strings.Contains(configuredTemplate, "{{resetLink}}") {
		return "", "", errors.New("configured email template is missing {{resetLink}}")
	}
	title := "请在 24 小时内完成邮箱绑定"
	subject := common.SystemName + "｜邮箱绑定通知：请于 24 小时内完成"
	description := "为防止通过多个账号重复领取、套取活动福利，维护平台公平使用秩序，请在收到本邮件后 24 小时内登录平台，前往「个人设置 → 账号与偏好」绑定并验证有效邮箱。超过 24 小时仍未完成邮箱绑定的账号，将被封禁。"
	notice := "如您已完成邮箱绑定，可忽略本通知。如遇到绑定问题，请通过站内工单联系管理员。感谢您的理解与配合。"
	root, err := xhtml.Parse(strings.NewReader(configuredTemplate))
	if err != nil {
		return "", "", errors.New("cannot parse the configured email template")
	}
	headings, descriptions, buttons, deadlines, notices := 0, 0, 0, 0, 0
	var adapt func(*xhtml.Node)
	adapt = func(node *xhtml.Node) {
		if node.Type == xhtml.CommentNode {
			// Preserve Outlook's conditional button and its configured styles.
			node.Data = strings.ReplaceAll(node.Data, "重置密码", "前往绑定邮箱")
		}
		if node.Type == xhtml.ElementNode {
			switch node.Data {
			case "title":
				setNodeText(node, "{{siteName}} · 邮箱绑定通知")
			case "h1":
				setNodeText(node, title)
				headings++
				if node.Parent != nil {
					for sibling := node.NextSibling; sibling != nil; sibling = sibling.NextSibling {
						if sibling.Type == xhtml.ElementNode && sibling.Data == "p" {
							setNodeText(sibling, description)
							descriptions++
							break
						}
					}
				}
			case "div":
				for _, attribute := range node.Attr {
					if attribute.Key == "aria-hidden" && attribute.Val == "true" {
						setNodeText(node, "{{siteName}} 邮箱绑定通知：收到邮件后 24 小时内完成绑定，逾期账号将被封禁。")
					}
				}
			case "a":
				for _, attribute := range node.Attr {
					if attribute.Key == "href" && attribute.Val == "{{resetLink}}" && !strings.Contains(nodeText(node), "{{resetLink}}") {
						setNodeText(node, "前往绑定邮箱")
						buttons++
					}
				}
			case "p":
				text := nodeText(node)
				if strings.Contains(text, "{{expireMinutes}}") {
					setNodeText(node, "请在收到本邮件后 24 小时内完成绑定，逾期账号将被封禁。")
					deadlines++
				} else if strings.Contains(text, "此链接仅用于本次密码重置") {
					setNodeText(node, notice)
					notices++
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			adapt(child)
		}
	}
	adapt(root)
	if headings != 1 || descriptions != 1 || buttons == 0 || deadlines == 0 || notices == 0 {
		return "", "", errors.New("configured template structure has changed; inspect its notice adaptation before sending")
	}
	var output strings.Builder
	if err := xhtml.Render(&output, root); err != nil {
		return "", "", errors.New("cannot render the configured email template")
	}
	content := common.RenderTemplate(output.String(), map[string]string{
		"siteName": html.EscapeString(common.SystemName), "resetLink": html.EscapeString(site.String()),
		"expireMinutes": "1440",
	})
	if strings.Contains(content, "{{") || strings.Contains(content, "密码重置") || strings.Contains(content, "重置密码") {
		return "", "", errors.New("notice still contains unresolved or password-reset content")
	}
	return subject, content, nil
}

func loadOptions(ctx context.Context) (map[string]string, error) {
	dsn := strings.TrimSpace(os.Getenv("SQL_DSN"))
	if !strings.HasPrefix(dsn, "postgres://") && !strings.HasPrefix(dsn, "postgresql://") {
		return nil, errors.New("SQL_DSN must contain the application's PostgreSQL connection string")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, errors.New("cannot initialize the options database connection")
	}
	defer db.Close()
	// Read only configuration; do not initialize models or run migrations.
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, errors.New("cannot connect to the options database")
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT key, value FROM options WHERE key IN (
		'ServerAddress', 'SMTPServer', 'SMTPPort', 'SMTPAccount', 'SMTPFrom', 'SMTPToken',
		'SMTPSSLEnabled', 'SMTPStartTLSEnabled', 'SMTPInsecureSkipVerify', 'SMTPForceAuthLogin',
		'EmailTemplatePasswordReset')`)
	if err != nil {
		return nil, errors.New("cannot read the application's mail configuration")
	}
	defer rows.Close()
	options := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, errors.New("cannot decode the application's mail configuration")
		}
		options[key] = value
	}
	if err := rows.Err(); err != nil {
		return nil, errors.New("mail configuration query did not complete")
	}
	return options, nil
}

func configureSMTP(options map[string]string) error {
	common.SMTPServer, common.SMTPAccount = options["SMTPServer"], options["SMTPAccount"]
	common.SMTPFrom, common.SMTPToken = options["SMTPFrom"], options["SMTPToken"]
	if common.SMTPServer == "" || (common.SMTPFrom == "" && common.SMTPAccount == "") {
		return errors.New("SMTP server and sender must be configured")
	}
	if value := options["SMTPPort"]; value != "" {
		port, err := strconv.Atoi(value)
		if err != nil || port < 1 || port > 65535 {
			return errors.New("invalid SMTPPort configuration")
		}
		common.SMTPPort = port
	}
	for key, destination := range map[string]*bool{
		"SMTPSSLEnabled": &common.SMTPSSLEnabled, "SMTPStartTLSEnabled": &common.SMTPStartTLSEnabled,
		"SMTPInsecureSkipVerify": &common.SMTPInsecureSkipVerify, "SMTPForceAuthLogin": &common.SMTPForceAuthLogin,
	} {
		if value := options[key]; value != "" {
			parsed, err := strconv.ParseBool(value)
			if err != nil {
				return fmt.Errorf("invalid %s configuration", key)
			}
			*destination = parsed
		}
	}
	return nil
}

func run() error {
	to := flag.String("to", "", "Single recipient email address")
	preview := flag.String("preview", "", "Write HTML to this new file instead of sending")
	flag.Parse()
	if flag.NArg() != 0 {
		return errors.New("unexpected positional arguments")
	}
	recipient, err := recipientAddress(*to)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	options, err := loadOptions(ctx)
	if err != nil {
		return err
	}
	subject, content, err := renderNotice(options["ServerAddress"], options[common.EmailTemplatePasswordResetKey])
	if err != nil {
		return err
	}
	if *preview != "" {
		file, err := os.OpenFile(*preview, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			return fmt.Errorf("cannot create preview: %w", err)
		}
		_, writeErr := file.WriteString(content)
		closeErr := file.Close()
		if writeErr != nil || closeErr != nil {
			return errors.New("cannot write preview")
		}
		return json.NewEncoder(os.Stdout).Encode(map[string]string{
			"status": "preview", "to": recipient, "subject": subject, "html_file": *preview,
		})
	}
	if err := configureSMTP(options); err != nil {
		return err
	}
	if err := common.SendEmail(subject, recipient, content); err != nil {
		return fmt.Errorf("email transmission failed; check provider delivery logs before retrying: %w", err)
	}
	return json.NewEncoder(os.Stdout).Encode(map[string]string{
		"status": "smtp_accepted", "to": recipient, "subject": subject,
		"sent_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
