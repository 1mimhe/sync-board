# Real-Time WebSocket Protocol — Test Cases

> Covers Socket.IO connection authentication, workspace/board rooms, dual-key Redis presence tracking, cursor broadcasts, and rate limiting.
> Sections: **A**utomatic (scriptable via socket.io-client) · **M**anual (two browsers) · **C**ombined (scripts + human).
> Setup: Users Alice (Owner) and Bob (Member) in Workspace W; Board B1, Document D1.

---

## 1. Connection & Authentication

| # | Type | Case | Steps | Expected |
|---|------|------|-------|----------|
| 1.1 | A | Valid connect | io(url, {auth:{token}}) | connect ack; server logs socket id |
| 1.2 | A | Missing token | no auth field | disconnect; `error` frame `{code:'TOKEN_INVALID'}` |
| 1.3 | A | Malformed/expired token | garbage / expired JWT | same as 1.2 (`TOKEN_INVALID`) |
| 1.4 | A | Blacklisted token | logout → reconnect w/ old token | rejected `{code:'TOKEN_REVOKED'}` |
| 1.5 | A | User private room | connect as Alice; Bob emits nothing | Alice auto-joined `user:{aliceId}` (verified via later notification push) |
| 1.6 | M | Reconnect resilience | kill app container; browser tab open | client retries ≤10×; after restart, rejoin rooms automatically; state refetched |

## 2. Workspace & Board Rooms

| # | Type | Case | Expected |
|---|------|------|----------|
| 2.1 | A | workspace:join member ok | ack `workspace:joined {onlineMembers}` |
| 2.2 | A | board:join without membership (outsider Carol) | error `BOARD_ACCESS_DENIED`; not in room |
| 2.3 | A | join switches rooms | joining B2 leaves B1 (no further B1 events) |
| 2.4 | A | duplicate join guard | second `board:join` same board → idempotent: re-joins the room, re-registers presence, and re-broadcasts `board:presence joined` (corrected 2026-08-30: NO `ROOM_ALREADY_JOINED` error — `handleBoardJoin` has no dup guard) |
| 2.5 | A | leave stops delivery | after board:leave, mutations emit nothing to leaver |
| 2.6 | A | REST↔WS mirror | Alice POSTs card → Bob receives `card:created` ≤2s with exact payload shape (catalog §3.3) |
| 2.7 | A | room isolation | Carol connected on other board receives zero frames during B1 activity |
| 2.8 | A | payload fidelity sweep | for each event in catalog (created/updated/moved/archived/unarchived × list/card/comment/label/checklist/attachment): trigger via REST, assert broadcast name+fields |
| 2.9 | C | move race | 2 scripts PATCH move same card alternately ×10 while human drags too | final GET board equals every client's applied state; no duplicated ranks; each accepted move produced exactly one `card:moved` |

## 3. Presence & Cursors

| # | Type | Case | Expected |
|---|------|------|----------|
| 3.1 | A | viewers on join | `board:viewers` lists both users w/ colors, avatar, connectedAt |
| 3.2 | A | presence join/leave frames | second join → peer gets `board:presence joined`; disconnect → `…left` |
| 3.3 | A | stale cleanup | stop heartbeats (pause timers), wait >90s | sweeper removes entry; Redis ZSET/HASH empty for board |
| 3.4 | A | heartbeat refresh | heartbeat every 30s keeps entry across 3 windows |
| 3.5 | A | cursor relay no-echo | Alice emits presence:cursor → Bob gets `board:cursor`; Alice does NOT receive own |
| 3.6 | A | cursor rate limit silent | burst >limit (600/min target; interim 20/min) → no error frames, connection alive (silent:true category) |
| 3.7 | A | non-silent rate limit | exceed board-event limit → `error RATE_LIMIT_EXCEEDED` referencing event |
| 3.8 | M | visual smoothness | human moves mouse fast on A | trail on B smooth, no jank/lag >100ms |
| 3.9 | M | multi-tab same user | same user 2 tabs | viewer list dedupes by userId OR shows both sockets consistently (match impl); disconnect one tab updates count correctly |

## 4. Document Collaboration

| # | Type | Case | Expected |
|---|------|------|----------|
| 4.1 | A | doc:join returns full state | binary initialState bytes parse into fresh Y.Doc |
| 4.2 | A | update relay verbatim | A sends binary update frame → B receives identical bytes |
| 4.3 | A | convergence | both clients exchange sv+diffs → equal final states |
| 4.4 | A | awareness relay | selection frames forwarded to peers only |
| 4.5 | A | editor lifecycle | editor-joined/left frames with user summary + color |
| 4.6 | A | saved event | after debounce window, both peers get `doc:saved {savedAt}` |
| 4.7 | A | access denied | outsider doc:join → `DOCUMENT_ACCESS_DENIED` |
| 4.8 | A | rate limits | doc:update 120/min → error at excess; awareness 600/min silent-ish per config |
| 4.9 | M | concurrent typing | both type same line | no keystrokes lost either side |
| 4.10 | M | offline merge | tab offline 60s, edits locally | on reconnect merges cleanly, both sides consistent |
| 4.11 | C | snapshot restore storm | human restores while bot types | restore state wins initially; subsequent bot ops apply atop restored doc without corruption |
| 4.12 | M | crash window | edit → kill server <5s → restart | data loss bounded to documented debounce window (accepted trade-off) |

## 5. Notification Push

| # | Type | Case | Expected |
|---|------|------|----------|
| 5.1 | A | live push | assign Bob via REST → Bob's socket `notification:new` ≤2s; `user:{id}` room targeted |
| 5.2 | A | offline catch-up | Bob disconnected during assignment | on reconnect, unread-count endpoint reflects it (pull path) |
| 5.3 | M | badge UX | bell badge increments/decrements matching REST counts exactly |

## 6. Rate-Limit Matrix (summary)

| Category | Limit/window (target) | Fail mode | Verified by |
|----------|------------------------|-----------|-------------|
| board:* events | 60/min | error frame | 3.7 |
| room joins | 10/min | error frame | A-scripted burst |
| presence:cursor | 600/min (interim 20) | silent drop | 3.6 |
| doc:update / awareness | 120 / 600 per min | mixed per config | 4.8 |
| redis pipeline failure | fail-open | limiter allows | unit spec parity check |

## 7. Cross-Cutting

| # | Type | Case | Expected |
|---|------|------|----------|
| 7.1 | A | invalid payloads | missing/wrong-typed fields → `INVALID_PAYLOAD` listing constraints |
| 7.2 | A | oversized binary frame | >max payload → error or disconnect per server policy (document actual) |
| 7.3 | A | multi-instance fanout *(profile full)* | two app replicas behind nginx ip_hash | event emitted via instance-1 reaches subscriber on instance-2 (redis adapter) |
| 7.4 | M | observability | correlationId from triggering REST call appears in consumer/broker logs |
