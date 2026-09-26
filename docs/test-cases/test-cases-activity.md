# Activity & Audit Log — Test Cases

> Covers workspace and board-scoped activity logging, cursor-paginated feeds, filtering, and partitioned storage.
> Environment setup: Users Alice (Owner) and Bob (Member) in Workspace W; boards B1 and B2 with active cards and lists.

## 1. Recording (via domain events)

| # | Trigger | Expected row |
|---|---------|--------------|
| 1.1 | create card on B1 | {workspace W, board B1, entity card, action created, actor Alice, payload.entityTitle} |
| 1.2 | move card | payload contains fromListId/toListId (+titles if denormalized) |
| 1.3 | comment/label/checklist/attachment events | each maps to its entityType row |
| 1.4 | board-level ops | archived/unarchived rows with board scope |
| 1.5 | workspace event (member added) | board_id NULL, entityType=workspace |
| 1.6 | listener failure containment | force repo error → logged; source operation unaffected |

## 2. Feed Endpoints

| # | Case | Expected |
|---|------|----------|
| 2.1 | Workspace feed cursor walk | seed 40 events → limit 20 pages complete, newest-first, no dupes across cursor pages |
| 2.2 | Board filter | GET /workspaces/W/activity?boardId=B1 → only B1 rows |
| 2.3 | Dedicated board route | `GET …/boards/B1/activities` (note: path is `/activities`, not `/activity`; verified against `board.controller.ts`) identical to filtered workspace route |
| 2.4 | entityType filter | single + combined filters (entityType+actor) honored |
| 2.5 | actor filter | only Alice's actions when actorId=Alice |
| 2.6 | RBAC | viewer CAN read feeds; outsider 403/404; unauth 401 |
| 2.7 | Response shape | id stringified BigInt; ISO createdAt; pagination envelope standard |

## 3. Partitioning & Migration Integrity

| # | Case | Expected |
|---|------|----------|
| 3.1 | Row lands in correct monthly partition | insert today → present in current-month child only |
| 3.2 | Partition manager cron | creates next-month child if missing; idempotent rerun |
| 3.3 | Backfill parity | counts match legacy table per board before drop; spot-check payloads |
| 3.4 | Legacy removal | `activities` table + ActionType enum dropped post-migration |
| 3.5 | Retention runbook | DROP old partition removes data instantly without bloat (document command) |
| 3.6 | Cross-partition query | feed spanning month boundary returns unified ordered results |
