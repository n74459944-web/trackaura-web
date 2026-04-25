# /admin/review/boards — Week 4 board proposal review UI

Closes the [TBD] from `ARCHITECTURE.md` §10 / §12. Three files:

```
src/app/admin/review/boards/
  page.tsx                 server component — fetches next proposal + queue stats
  board-action-panel.tsx   client component — three decision sections
  actions.ts               server actions — link / create / reject / skip
```

Drop them at `C:\dev\trackaura-web\src\app\admin\review\boards\`.

Mirrors the existing `/admin/review` (chip review) pattern: shared-secret auth via `requireAdmin()`, service-role writes via `createAdminClient()`, skip-by-cookie within a session, queue advances on `revalidatePath()`.

## Three decision paths

1. **Link existing** — picks one of the candidate boards from the proposal's `candidate_boards` JSONB. Inserts a `listings` row pointing at that board, plus a `price_observations` row if `price_cad` is set, and marks the proposal `approved` / `linked_existing`.
2. **Create new board** — inserts a new `canonical_entities` row (entity_type=`gpus`, parent=resolved chip), inserts `entity_attributes` for `memory_gb` (price-defining, per §3) and `product_line` (cosmetic), then writes the listing + observation, marks `approved` / `created_new`.
3. **Reject** — marks the proposal `rejected_<reason>`. No writes to the new schema. Reasons: not_a_gpu, duplicate_existing, scraper_error, wrong_chip, other.
4. **Skip** — appends proposal id to a session cookie. No DB write. The page filters skipped ids when fetching the next proposal. Restart link clears the cookie.

Per §5 principle #3 (clarified 2026-04-23): no auto-creation. Both link and create require an explicit human click.

## Schema assumptions to verify before deploying

The actions write to four `pending_board_proposals` decision columns that the bible documents only as "decision audit fields." The assumed names are:

```
status              text   -- 'pending' | 'approved' | 'rejected'
decision_outcome    text
decided_entity_id   bigint -- FK canonical_entities, the resolved board
decided_at          timestamptz
decided_by          text
```

If the actual migration `2026_04_24_pending_board_proposals.sql` named any of them differently, edit `buildDecisionPatch()` at the bottom of `actions.ts` — every decision write funnels through that helper.

Verify with:

```powershell
cd C:\dev\trackaura-web ; npx supabase db pull --schema public > schema-snapshot.sql
```

Or inspect directly in the Supabase SQL editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pending_board_proposals'
ORDER BY ordinal_position;
```

## Candidate JSONB shape

The page reads these fields from each entry in `candidate_boards`:

```
entity_id          required, used as the link target
canonical_name     required, displayed
brand              optional, shown if present
score              required, displayed and used for sort
shared_sku_token   optional, shown if present (debugging context)
brand_match        optional
jaccard            optional
memory_gb          optional
product_line       optional
singleton_bonus    optional, shown as a flag
```

The display falls back gracefully if the resolver wrote a leaner shape — only `entity_id`, `canonical_name`, `score` are required for the UI to render.

## Deploying

```powershell
cd C:\dev\trackaura-web
git status --short
# expect to see only the three new files in src/app/admin/review/boards/
git add src/app/admin/review/boards/
git commit -m "Add /admin/review/boards UI for pending board proposals"
git push
```

The Vercel deploy should be a no-op for the rest of the site — no shared imports beyond `@/lib/supabase/admin` and `@/lib/admin/auth`, which are already in the build.

## Smoke test after deploy

1. Visit `https://www.trackaura.com/admin/login` and authenticate with the shared secret if not already.
2. Navigate to `/admin/review/boards`. Header should show "378 pending" (the post-`--apply` count from the 2026-04-24 sync run).
3. Pick the first proposal. Verify:
   - Source listing renders (retailer, raw_title, price, scraped timestamp, link to retailer)
   - Resolved chip parent renders (canonical_name + id)
   - Candidate boards listed with scores, sorted desc
4. Test each path on a sample proposal:
   - **Link existing:** pick a candidate, confirm a `listings` row appears in Supabase `WHERE retailer=... AND url=...` and `pending_board_proposals.status` flipped to `approved`.
   - **Create new:** fill canonical_name, click create. Confirm a new `canonical_entities` row with parent=chip_id, plus `entity_attributes` rows for memory_gb (is_price_defining=true) and product_line if filled.
   - **Reject:** pick a non-GPU proposal (resolver_tier `board_match_no_match` is the most likely place to find one), pick "Not a GPU", confirm status flips to `rejected_not_a_gpu`.

## Bible updates after this ships

`ARCHITECTURE.md`:

- §10 Week 4: tick `Admin UI for board proposals at /admin/review/boards`.
- §12: resolve the `[TBD] Admin UI for board proposals` line, mark `[RESOLVED 2026-04-24]`.
- Add a Draft 7 changelog entry capturing the smoke-test result and any column-name corrections that surface.

## Out of scope for this slice

- **Bulk approve.** A future iteration could add "approve all candidates with score ≥ 0.85" once we trust the scorer at production volume — but bible §5 principle #3 says no auto-create, and bulk-approve is auto-create with a wrapper. Defer.
- **Merge two existing boards into one.** The `wrong_chip` and `duplicate_existing` reject paths flag the issue but don't fix it. Merge tooling is a separate feature.
- **Edit candidate scores.** Read-only for now — the scoring tunes happen in `resolver/board_match.py`, not in the UI.
- **Search/filter the queue.** 378 is small enough to FIFO through. Revisit when the queue is order-of-magnitude larger.
