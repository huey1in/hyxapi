# Model Pricing Pagination and Upstream Sync Design

## Goal

Make the root-only model original-price editor usable with larger model catalogs and allow administrators to import verified original USD prices from `https://models.dev/api.json` without silently overwriting local values.

## Pagination

Pagination is client-side because the editor combines persisted `model_pricing` rows with enabled models that do not yet have a saved price. The complete merged row array remains the source of truth so edits survive page changes. The UI derives the current slice from `page` and `pageSize`, supports 10, 20, and 50 rows per page, resets to page 1 when page size changes, and clamps the active page when rows are removed.

## Upstream Source and Mapping

The backend fetches `https://models.dev/api.json` with a bounded timeout and response-size limit. It parses provider model costs and maps them into Routify's direct price schema:

- `input` -> `input_price`
- `output` -> `output_price`
- `cache_read` -> `cache_read_price`
- `cache_write` -> `cache_write_price`

All token prices are USD per one million tokens. Models without usable price data are omitted. When several providers publish the same model ID, a deterministic provider/model ordering selects one result so previews are stable.

The sync endpoint intersects upstream model IDs with models returned by `model.GetEnabledModels()`. It never imports unrelated catalog entries.

## Preview and Apply

`POST /api/model-pricing/sync/preview` fetches upstream prices and returns rows containing the local price, upstream price, source provider, and whether values differ. New prices are selected by default. Changed existing prices require explicit selection in the preview dialog.

`POST /api/model-pricing/sync/apply` accepts selected preview rows. The backend validates every row again, restricts names to currently enabled models, and writes all selected rows in one database transaction. Existing rows are updated by model name; missing rows are created. Successful application invalidates pricing caches once and records an audit entry.

The preview is a safety boundary, not an authorization boundary. Both endpoints remain protected by `RootAuth`, and apply independently validates client input.

## Failure Handling

Network errors, non-2xx responses, oversized payloads, malformed JSON, invalid or negative costs, and empty matches return a useful error without changing the database. Transaction failure rolls back every selected change.

## Testing

Backend tests cover models.dev parsing, deterministic duplicate handling, enabled-model filtering, validation, and transactional upsert. Frontend tests cover page slicing/clamping, default sync selection, and preview-to-apply payload construction. Existing model-pricing and billing tests remain unchanged and must pass.
