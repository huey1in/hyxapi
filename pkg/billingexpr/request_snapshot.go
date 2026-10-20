package billingexpr

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/parser"
	"github.com/tidwall/gjson"
)

// FreezeTaskRequestContext preserves request conditions for both reservation
// and asynchronous completion, including after a process restart. Usage facts
// remain separate because completion may replace estimated quantities.
func FreezeTaskRequestContext(expression string, request RequestInput, at time.Time) (*FrozenRequestContext, error) {
	_, body := ParseExprVersion(expression)
	tree, err := parser.Parse(body)
	if err != nil {
		return nil, err
	}
	if !usesRequestProbe(tree.Node) {
		return nil, nil
	}
	if at.IsZero() {
		at = time.Now()
	}
	visitor := &taskRequestProbeCollector{request: request, headers: normalizeHeaders(request.Headers),
		frozen: &FrozenRequestContext{At: at.UTC(), Params: map[string]any{}, Headers: map[string]string{}}}
	ast.Walk(&tree.Node, visitor)
	if visitor.err != nil {
		return nil, visitor.err
	}
	encoded, err := json.Marshal(visitor.frozen)
	if err != nil {
		return nil, err
	}
	if len(encoded) > 64*1024 {
		return nil, fmt.Errorf("task billing request conditions exceed 64 KiB")
	}
	return visitor.frozen, nil
}

type taskRequestProbeCollector struct {
	request RequestInput
	headers map[string]string
	frozen  *FrozenRequestContext
	err     error
}

func (v *taskRequestProbeCollector) Visit(node *ast.Node) {
	call, ok := (*node).(*ast.CallNode)
	if !ok || v.err != nil {
		return
	}
	callee, ok := call.Callee.(*ast.IdentifierNode)
	if !ok || (callee.Value != "param" && callee.Value != "header") {
		return
	}
	if len(call.Arguments) != 1 {
		v.err = fmt.Errorf("invalid task billing request condition")
		return
	}
	key, ok := call.Arguments[0].(*ast.StringNode)
	if !ok {
		v.err = fmt.Errorf("task billing param/header paths must be string literals so conditions can be frozen")
		return
	}
	path := strings.TrimSpace(key.Value)
	if callee.Value == "header" {
		path = strings.ToLower(path)
		v.frozen.Headers[path] = v.headers[path]
	} else {
		var value any
		if path != "" && len(v.request.Body) > 0 {
			value = gjson.GetBytes(v.request.Body, path).Value()
		}
		v.frozen.Params[path] = value
	}
}
