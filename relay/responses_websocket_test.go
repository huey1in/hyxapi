package relay

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func normalizeResponsesWSTestMessage(message []byte) (responsesWSCreateRequest, string, error) {
	envelope, streamID, err := parseResponsesWSEnvelope(message)
	if err != nil {
		return responsesWSCreateRequest{StreamID: streamID}, envelope.EventID, err
	}
	create, err := normalizeResponsesWSCreateEvent(message, envelope, streamID)
	return create, envelope.EventID, err
}

func TestNormalizeResponsesWSMaxOutputTokens(t *testing.T) {
	for _, tc := range []struct {
		value string
		valid bool
	}{
		{value: "0", valid: true},
		{value: "1073741823", valid: true},
		{value: "1073741824"},
		{value: "18446744073686646784"},
		{value: "-1"},
	} {
		for _, wrapped := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/wrapped=%t", tc.value, wrapped), func(t *testing.T) {
				fields := `"model":"gpt-5.1","input":"hi","max_output_tokens":` + tc.value
				payload := `{"type":"response.create",` + fields + `}`
				if wrapped {
					payload = `{"type":"response.create","response":{` + fields + `}}`
				}
				create, _, err := normalizeResponsesWSTestMessage([]byte(payload))
				if !tc.valid {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, newResponsesWSInvalidRequestError(err).StatusCode)
					return
				}
				require.NoError(t, err)
				require.NotNil(t, create.Request.MaxOutputTokens)
				assert.Equal(t, tc.value, fmt.Sprint(*create.Request.MaxOutputTokens))
			})
		}
	}
}

func TestNormalizeResponsesWSCreateEventWrapper(t *testing.T) {
	message := []byte(`{
		"type": "response.create",
		"event_id": "evt_1",
		"generate": false,
		"response": {
			"model": "gpt-5.3-codex-spark",
			"input": "hi",
			"store": false,
			"stream": true,
			"stream_options": {"include_usage": true}
		}
	}`)

	create, eventID, err := normalizeResponsesWSTestMessage(message)
	if err != nil {
		t.Fatalf("normalizeResponsesWSTestMessage() error = %v", err)
	}
	req := create.Request
	if eventID != "evt_1" {
		t.Fatalf("eventID = %q, want evt_1", eventID)
	}
	if req.Model != "gpt-5.3-codex-spark" {
		t.Fatalf("model = %q", req.Model)
	}
	if strings.TrimSpace(string(create.Generate)) != "false" {
		t.Fatalf("generate = %s, want false", create.Generate)
	}
	if req.Stream != nil {
		t.Fatalf("stream = %v, want nil", req.Stream)
	}
	if req.StreamOptions != nil {
		t.Fatalf("stream_options = %#v, want nil", req.StreamOptions)
	}
	if strings.TrimSpace(string(req.Store)) != "false" {
		t.Fatalf("store = %s, want false", req.Store)
	}
}

func TestNormalizeResponsesWSCreateEventFlat(t *testing.T) {
	message := []byte(`{
		"type": "response.create",
		"event_id": "evt_2",
		"model": "gpt-5.3-codex-spark",
		"input": "hi",
		"generate": false,
		"stream": true,
		"background": true,
		"stream_options": {"include_usage": true}
	}`)

	create, eventID, err := normalizeResponsesWSTestMessage(message)
	if err != nil {
		t.Fatalf("normalizeResponsesWSTestMessage() error = %v", err)
	}
	req := create.Request
	if eventID != "evt_2" {
		t.Fatalf("eventID = %q, want evt_2", eventID)
	}
	if req.Model != "gpt-5.3-codex-spark" {
		t.Fatalf("model = %q", req.Model)
	}
	if strings.TrimSpace(string(create.Generate)) != "false" {
		t.Fatalf("generate = %s, want false", create.Generate)
	}
	if req.Stream != nil {
		t.Fatalf("stream = %v, want nil", req.Stream)
	}
	if req.StreamOptions != nil {
		t.Fatalf("stream_options = %#v, want nil", req.StreamOptions)
	}
}

func TestBuildResponsesWSCreateEventIsFlat(t *testing.T) {
	payload := []byte(`{
		"model": "gpt-5.3-codex-spark",
		"input": "hi",
		"store": false,
		"event_id": "evt_upstream",
		"stream": true,
		"background": true,
		"stream_options": {"include_usage": true}
	}`)

	got, err := buildResponsesWSCreateEvent(payload, json.RawMessage(`false`), "")
	if err != nil {
		t.Fatalf("buildResponsesWSCreateEvent() error = %v", err)
	}
	var data map[string]any
	if err := common.Unmarshal(got, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data["type"] != responsesWSEventTypeResponseCreate {
		t.Fatalf("type = %#v", data["type"])
	}
	if data["model"] != "gpt-5.3-codex-spark" || data["input"] != "hi" || data["store"] != false {
		t.Fatalf("unexpected flat event fields: %s", got)
	}
	if data["generate"] != false {
		t.Fatalf("generate = %#v, want false", data["generate"])
	}
	for _, key := range []string{"response", "event_id", "stream", "background", "stream_options"} {
		if _, ok := data[key]; ok {
			t.Fatalf("field %q should not be present in upstream event: %s", key, got)
		}
	}
}

func TestHTTPResponsesRequestOmitsWebSocketMetadata(t *testing.T) {
	var req dto.OpenAIResponsesRequest
	require.NoError(t, common.Unmarshal([]byte(`{"model":"gpt-5.3-codex-spark","input":"hi","generate":false,"stream_id":"planner"}`), &req))
	got, err := common.Marshal(req)
	require.NoError(t, err)
	var data map[string]any
	require.NoError(t, common.Unmarshal(got, &data))
	assert.NotContains(t, data, "stream_id")
	assert.NotContains(t, data, "generate")
}

func TestBuildResponsesWSErrorPayloadIncludesStatus(t *testing.T) {
	payload, err := buildResponsesWSErrorPayload("evt_err", "", types.NewErrorWithStatusCode(
		errors.New("model is required"),
		types.ErrorCodeInvalidRequest,
		http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	))
	if err != nil {
		t.Fatalf("buildResponsesWSErrorPayload() error = %v", err)
	}
	var data struct {
		Type    string             `json:"type"`
		Status  int                `json:"status"`
		EventID string             `json:"event_id"`
		Error   *types.OpenAIError `json:"error"`
	}
	if err := common.Unmarshal(payload, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data.Type != "error" || data.Status != http.StatusBadRequest || data.EventID != "evt_err" {
		t.Fatalf("unexpected error event: %s", payload)
	}
	if data.Error == nil || data.Error.Code != string(types.ErrorCodeInvalidRequest) {
		t.Fatalf("unexpected error body: %#v", data.Error)
	}
}

func TestResponsesWSInvalidRequestErrorUsesBadRequestStatus(t *testing.T) {
	payload, err := buildResponsesWSErrorPayload("", "", newResponsesWSInvalidRequestError(errors.New("bad event")))
	if err != nil {
		t.Fatalf("buildResponsesWSErrorPayload() error = %v", err)
	}
	var data struct {
		Status int `json:"status"`
	}
	if err := common.Unmarshal(payload, &data); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}
	if data.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", data.Status, http.StatusBadRequest)
	}
}

func newTestResponsesWSTarget(t *testing.T) (*websocket.Conn, func()) {
	t.Helper()
	target, _, cleanup := newTestWebSocketPair(t)
	return target, cleanup
}

func newTestWebSocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn, func()) {
	t.Helper()
	upgrader := websocket.Upgrader{}
	serverConnCh := make(chan *websocket.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade websocket: %v", err)
			return
		}
		serverConnCh <- conn
	}))

	targetURL := "ws" + strings.TrimPrefix(server.URL, "http")
	target, _, err := websocket.DefaultDialer.Dial(targetURL, nil)
	if err != nil {
		server.Close()
		t.Fatalf("dial websocket: %v", err)
	}
	serverConn := <-serverConnCh
	cleanup := func() {
		_ = target.Close()
		_ = serverConn.Close()
		server.Close()
	}
	return target, serverConn, cleanup
}

func TestResponsesWSMessageSizeLimit(t *testing.T) {
	previous := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = previous })
	client, server, cleanup := newTestWebSocketPair(t)
	defer cleanup()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
	var admitted atomic.Bool
	done := make(chan struct{})
	go func() {
		defer close(done)
		ResponsesWebSocketHelper(c, server, func(*http.Request, string, func(*gin.Context) *types.NewAPIError) *types.NewAPIError {
			admitted.Store(true)
			return nil
		})
	}()
	_ = client.WriteMessage(websocket.TextMessage, []byte(strings.Repeat("x", (1<<20)+1)))
	require.NoError(t, client.SetReadDeadline(time.Now().Add(5*time.Second)))
	_, _, err := client.ReadMessage()
	assert.True(t, websocket.IsCloseError(err, websocket.CloseMessageTooBig), "oversized message must be rejected before admission: %v", err)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("websocket request did not exit after oversized message")
	}
	assert.False(t, admitted.Load())
}

func TestResponsesWSShutdownInterruptsBusyWriter(t *testing.T) {
	client, server, cleanupClient := newTestWebSocketPair(t)
	defer cleanupClient()
	target, peer, cleanupTarget := newTestWebSocketPair(t)
	defer cleanupTarget()
	ctx, cancel := context.WithCancel(context.Background())
	s := &responsesWSSession{ctx: ctx, cancel: cancel, client: server, target: target}
	// Blocked network writers own these locks. Shutdown must not wait for
	// them: its close frames are bounded control writes, and closing the
	// sockets is what interrupts those writers.
	s.clientWriteMu.Lock()
	defer s.clientWriteMu.Unlock()
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	done := make(chan struct{})
	go func() { s.shutdown(websocket.CloseInternalServerErr, "upstream connection closed"); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown waited for a network writer")
	}
	// A dropped socket would read as a synthetic 1006; 1011 is the frame.
	for _, conn := range []*websocket.Conn{client, peer} {
		require.NoError(t, conn.SetReadDeadline(time.Now().Add(time.Second)))
		_, _, err := conn.ReadMessage()
		assert.True(t, websocket.IsCloseError(err, websocket.CloseInternalServerErr), "want a 1011 close frame, got %v", err)
	}
	assert.Nil(t, s.getTarget())

	// An upstream dial that completes after shutdown is closed with a frame too.
	late, latePeer, cleanupLate := newTestWebSocketPair(t)
	defer cleanupLate()
	assert.False(t, s.setTarget(late))
	require.NoError(t, latePeer.SetReadDeadline(time.Now().Add(time.Second)))
	_, _, err := latePeer.ReadMessage()
	assert.True(t, websocket.IsCloseError(err, websocket.CloseNormalClosure), "want a 1000 close frame, got %v", err)
}

func TestResponsesWSPassthroughPreservesRawPricingParameters(t *testing.T) {
	create, _, err := normalizeResponsesWSTestMessage([]byte(`{"type":"response.create","generate":false,"response":{"model":"gpt-5.1","input":"hi","vendor":{"tier":"premium"},"stream":true}}`))
	require.NoError(t, err)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(string(create.Body)))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, create.Request.Model)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: true})
	info := relaycommon.GenRelayInfoResponses(c, &create.Request)
	payload, apiErr := buildResponsesWSCreatePayload(c, info, create.Request, create.Generate, create.StreamID)
	require.Nil(t, apiErr)
	assert.JSONEq(t, `{"type":"response.create","generate":false,"model":"gpt-5.1","input":"hi","vendor":{"tier":"premium"}}`, string(payload))
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	require.NoError(t, storage.Close())
}

func TestResponsesWSStreamIdentity(t *testing.T) {
	for _, tc := range []struct {
		name, fields, want string
		invalid            bool
	}{
		{name: "default", fields: `"model":"gpt-4o"`},
		{name: "named", fields: `"model":"gpt-4o","stream_id":"planner.A-1_2"`, want: "planner.A-1_2"},
		{name: "wrapped", fields: `"response":{"model":"gpt-4o","stream_id":"wrapped"}`, want: "wrapped"},
		{name: "top-level-wins", fields: `"stream_id":"outer","response":{"model":"gpt-4o","stream_id":"inner"}`, want: "outer"},
		{name: "maximum", fields: `"model":"gpt-4o","stream_id":"` + strings.Repeat("a", 256) + `"`, want: strings.Repeat("a", 256)},
		{name: "too-long", fields: `"stream_id":"` + strings.Repeat("a", 257) + `"`, invalid: true},
		{name: "empty", fields: `"stream_id":""`, invalid: true},
		{name: "null", fields: `"stream_id":null`, invalid: true},
		{name: "number", fields: `"stream_id":123`, invalid: true},
		{name: "unicode", fields: `"stream_id":"计划"`, invalid: true},
		{name: "spaces", fields: `"stream_id":"a b"`, invalid: true},
		{name: "invalid-top-level", fields: `"stream_id":"","response":{"stream_id":"inner"}`, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			create, eventID, err := normalizeResponsesWSTestMessage([]byte(`{"type":"response.create","event_id":"test",` + tc.fields + `}`))
			assert.Equal(t, "test", eventID)
			if tc.invalid {
				require.ErrorContains(t, err, "stream_id")
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, create.StreamID)
			assert.NotContains(t, string(create.Body), "stream_id")
			for _, passthrough := range []bool{false, true} {
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(string(create.Body)))
				common.SetContextKey(c, constant.ContextKeyOriginalModel, create.Request.Model)
				common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
				common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{PassThroughBodyEnabled: passthrough})
				info := relaycommon.GenRelayInfoResponses(c, &create.Request)
				payload, apiErr := buildResponsesWSCreatePayload(c, info, create.Request, create.Generate, create.StreamID)
				require.Nil(t, apiErr)
				var event map[string]any
				require.NoError(t, common.Unmarshal(payload, &event))
				if tc.want == "" {
					assert.NotContains(t, event, "stream_id")
				} else {
					assert.Equal(t, tc.want, event["stream_id"])
				}
				if storage, err := common.GetBodyStorage(c); err == nil {
					require.NoError(t, storage.Close())
				}
			}
		})
	}
}

func TestResponsesWSErrorAttribution(t *testing.T) {
	for _, tc := range []struct {
		name, payload, control            string
		terminal, ambiguous, controlError bool
	}{
		{name: "active-server-failure", payload: `{"status":500,"error":{"type":"server_error"}}`, terminal: true},
		{name: "other-stream", payload: `{"stream_id":"other","status":500}`},
		{name: "previous-response", payload: `{"response_id":"previous","status":500}`},
		{name: "cancel-event-id", payload: `{"event_id":"cancel","status":500}`, control: `{"event_id":"cancel"}`, controlError: true},
		{name: "cancel-target", payload: `{"response_id":"missing","status":400}`, control: `{"response_id":"missing"}`, controlError: true},
		{name: "cancel-code", payload: `{"error":{"type":"invalid_request_error","code":"response_not_found"}}`, control: `{"response_id":"missing"}`, controlError: true},
		{name: "ambiguous-after-cancel", payload: `{"status":500}`, control: `{"response_id":"active"}`, terminal: true, ambiguous: true},
		{name: "explicit-generation-failure", payload: `{"response_id":"active","status":500}`, control: `{"response_id":"active"}`, terminal: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var event responsesWSErrorEvent
			require.NoError(t, common.Unmarshal([]byte(tc.payload), &event))
			terminal, ambiguous, controlError := responsesWSErrorEndsRequest(event, "planner", "active", []byte(tc.control))
			assert.Equal(t, tc.terminal, terminal)
			assert.Equal(t, tc.ambiguous, ambiguous)
			assert.Equal(t, tc.controlError, controlError)
		})
	}
}
