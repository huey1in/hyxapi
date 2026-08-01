# Token Multi-Group Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow one API token to use an ordered list of groups and move to the next group for configured HTTP status codes.

**Architecture:** Store ordered group names and switch status codes as JSON on the token. Resolve the first usable group before relay, and let the existing retry loop advance the group cursor only when the final error matches the token policy. Preserve the full ordered retry history in task/log context.

**Tech Stack:** Go, GORM, Gin, React, existing relay retry pipeline and token editor.

---

### Task 1: Token data model and API contract

**Files:** `model/token.go`, `controller/token.go`, token tests.

- [ ] Add `Groups []string` and `GroupSwitchStatusCodes []int` JSON-backed fields, validation and normalization helpers.
- [ ] Migrate a legacy single `group` value into a one-item ordered list when reading/updating; serialize the new fields in token responses.
- [ ] Add tests for normalization, duplicate removal, invalid status codes, and legacy conversion.

### Task 2: Group-aware relay selection

**Files:** `relay/common/relay_info.go`, `service/channel_select.go`, `controller/relay.go`, retry tests.

- [ ] Carry ordered token groups and current group index in relay context.
- [ ] Select channels using the current group while preserving existing model/channel retry behavior.
- [ ] After a terminal response, advance to the next group only when its status code is configured; reset channel exclusions for the new group.
- [ ] Record group transitions and ensure all groups exhausted returns the final error.
- [ ] Add tests for priority order, status-code hit, non-hit, and exhaustion.

### Task 3: Token editor UI

**Files:** `web/src/pages/Token/index.jsx`, related frontend tests.

- [ ] Replace the single group selector with an ordered editable list with add/remove and move-up/move-down controls.
- [ ] Add multi-select status-code configuration with common defaults and visible custom values.
- [ ] Submit `groups` and `group_switch_status_codes`; display multiple groups in the token list.
- [ ] Add tests for serialization, ordering, and legacy response rendering.

### Task 4: Verification and rollout

- [ ] Run Go unit tests for model/controller/relay packages.
- [ ] Run frontend tests and `npm run build`.
- [ ] Review migration behavior against an existing token database, restart the service, and smoke-test `/api/status` and token CRUD.
