# Model Pricing Pagination and Upstream Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stable client-side pagination and a safe models.dev price synchronization workflow to the root model-pricing editor.

**Architecture:** A focused backend sync service fetches and normalizes models.dev prices, while root-only controller endpoints expose preview and transactional apply operations. The React editor keeps its merged row collection intact, derives the visible page, and opens a difference-selection modal before applying upstream changes.

**Tech Stack:** Go, Gin, GORM, React 18, Vite, project UI components, Node test runner

---

### Task 1: Parse and Filter Upstream Prices

**Files:**
- Create: `model/model_pricing_sync.go`
- Create: `model/model_pricing_sync_test.go`

- [ ] **Step 1: Write failing parser tests**

Add table-driven tests using a compact models.dev JSON fixture. Assert conversion of input/output/cache fields, omission of negative or empty prices, enabled-model filtering, and deterministic selection for duplicate model IDs.

- [ ] **Step 2: Verify the parser tests fail**

Run: `go test ./model -run 'TestParseModelsDevPrices|TestFilterUpstreamModelPrices' -count=1`

Expected: FAIL because the parser and filter functions do not exist.

- [ ] **Step 3: Implement the parser and filter**

Define a small upstream JSON shape, normalize finite non-negative costs into `ModelPricing`, sort providers and model IDs before resolving duplicates, and filter against an enabled-model set.

- [ ] **Step 4: Verify the parser tests pass**

Run: `go test ./model -run 'TestParseModelsDevPrices|TestFilterUpstreamModelPrices' -count=1`

Expected: PASS.

### Task 2: Preview and Transactionally Apply Sync

**Files:**
- Create: `controller/model_pricing_sync.go`
- Create: `controller/model_pricing_sync_test.go`
- Modify: `model/model_pricing_sync.go`
- Modify: `router/api-router.go`

- [ ] **Step 1: Write failing service and handler tests**

Test bounded HTTP fetching with `httptest.Server`, preview intersection with enabled models, rejection of unsupported models during apply, and rollback when one selected row is invalid.

- [ ] **Step 2: Verify sync tests fail**

Run: `go test ./controller ./model -run 'TestModelPricingSync|TestApplyModelPricingSync' -count=1`

Expected: FAIL because fetch, preview, apply, and routes are absent.

- [ ] **Step 3: Implement fetch, preview, and apply**

Use a timeout-aware `http.Client`, a 10 MiB response limit, explicit status checks, and dependency injection for the upstream URL in tests. Apply selected rows through one GORM transaction, upsert by `model_name`, invalidate caches after commit, and return the saved count.

- [ ] **Step 4: Register root-only endpoints**

Add `POST /api/model-pricing/sync/preview` and `POST /api/model-pricing/sync/apply` inside the existing `RootAuth` model-pricing group.

- [ ] **Step 5: Verify backend tests pass**

Run: `go test ./controller ./model -run 'TestModelPricingSync|TestApplyModelPricingSync|TestModelPricing' -count=1`

Expected: PASS.

### Task 3: Add Stable Pagination Helpers and UI

**Files:**
- Modify: `web/src/pages/Setting/ModelPricingEditor.jsx`
- Modify: `web/src/pages/modelPricingFrontend.test.js`

- [ ] **Step 1: Write failing pagination helper tests**

Assert that page slicing returns the correct rows, invalid pages clamp after deletion, and changing page size returns page 1 without mutating the full row array.

- [ ] **Step 2: Verify pagination tests fail**

Run: `node --test web/src/pages/modelPricingFrontend.test.js`

Expected: FAIL because pagination helpers are absent.

- [ ] **Step 3: Implement derived pagination**

Export pure page-count, clamp, and slice helpers. Add page and page-size state, render only the derived slice, clamp after row-count changes, and use the existing UI `Pagination` control plus a 10/20/50 size selector.

- [ ] **Step 4: Verify frontend tests pass**

Run: `node --test web/src/pages/modelPricingFrontend.test.js`

Expected: PASS.

### Task 4: Add Sync Preview Dialog

**Files:**
- Modify: `web/src/pages/Setting/ModelPricingEditor.jsx`
- Modify: `web/src/pages/modelPricingFrontend.test.js`

- [ ] **Step 1: Write failing selection tests**

Assert new upstream prices are selected by default, changed saved prices are unselected, unchanged rows are omitted, and the apply payload contains only explicitly selected upstream values.

- [ ] **Step 2: Verify selection tests fail**

Run: `node --test web/src/pages/modelPricingFrontend.test.js`

Expected: FAIL because preview selection helpers do not exist.

- [ ] **Step 3: Implement the sync interaction**

Add a `同步上游价格` button with refresh icon. Load preview data on click, render source and local/upstream differences in the project `Modal`, provide checkboxes per changed model, post selected rows to apply, close on success, and reload the editor while preserving clear loading and error states.

- [ ] **Step 4: Verify frontend tests pass**

Run: `node --test web/src/pages/modelPricingFrontend.test.js`

Expected: PASS.

### Task 5: Full Verification and Runtime Refresh

**Files:**
- Modify generated frontend bundle under `web/dist` through the existing build command

- [ ] **Step 1: Run focused and full relevant tests**

Run: `go test ./model ./controller ./relay/helper ./service -count=1`

Run: `node --test web/src/pages/modelPricingFrontend.test.js web/src/i18n/legacyPricingLocales.test.js`

Expected: all PASS.

- [ ] **Step 2: Build the frontend**

Run: `npm run build` from `web`.

Expected: Vite build succeeds without errors.

- [ ] **Step 3: Run static checks**

Run: `gofmt -w model/model_pricing_sync.go model/model_pricing_sync_test.go controller/model_pricing_sync.go controller/model_pricing_sync_test.go`

Run: `git diff --check`

Expected: no formatting errors.

- [ ] **Step 4: Restart and smoke-test the backend**

Stop the existing HyxAPI development process, start `go run main.go`, then request `/api/status` and verify HTTP 200. Confirm unauthenticated sync requests are rejected by root authentication.
