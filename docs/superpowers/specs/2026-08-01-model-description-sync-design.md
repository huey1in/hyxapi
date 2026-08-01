# Model Description Sync Design

## Goal

Show useful descriptions on model detail pages by filling empty local model metadata from the same models.dev source used for original prices.

## Data Ownership

The existing `models.description` column remains the single description field. A non-empty local description is administrator-owned and is never overwritten by an upstream sync. An empty description may be filled from models.dev. The public `/api/pricing` response already includes this field, so the pricing list and detail pages receive the same value without a second API.

## Sync Flow

The existing upstream preview parses a model description when available and reports whether the local description is empty. The apply request re-fetches canonical upstream data, validates selected enabled models, and transactionally updates prices. For each selected model, it updates `models.description` only when the current value is blank. Price rows continue to be upserted as before. A single cache invalidation refreshes public pricing metadata after commit.

Descriptions are trimmed, limited to a reasonable size, and empty or malformed upstream values are ignored. Failed requests and transaction errors leave both prices and descriptions unchanged.

## UI

The model detail page keeps its existing description section. The sync preview labels rows that will add an upstream description, while rows with a local description are labeled as preserved. No duplicate description editor or hard-coded model copy is introduced.

## Testing

Backend tests cover description parsing, preserving non-empty local descriptions, filling empty descriptions transactionally, and rollback. Frontend tests cover preview labels and the existing detail rendering path for `description`.
