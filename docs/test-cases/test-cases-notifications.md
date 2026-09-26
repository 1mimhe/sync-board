# Notifications & Message Queue — Test Cases

> Covers domain event producers, RabbitMQ asynchronous consumer, idempotency deduplication, dead-letter retries, and REST management.
> Environment setup: Users Alice (Actor) and Bob (Recipient, Member) in Workspace W; Board B1 and Card C1.

## 1. Producers → Messages

| # | Trigger | Expected message |
|---|---------|------------------|
| 1.1 | addAssignee(Bob) | routing `notification.card.assigned`; payload {userId:Bob,…}; Bob NOT notified for self-assign |
| 1.2 | comment on card where Bob is assignee | `notification.comment.added` to assignees ≠ author |
| 1.3 | comment "@bob@t.local please review" (member email) | additional `comment_mentioned` mapped via email→userId |
| 1.4 | mention unknown/non-member email | no message; no failure of comment creation |
| 1.5 | invite accepted (member_added) | `workspace_invited` welcome notification row |
| 1.6 | role changed by admin | `workspace_role_changed` to target user |
| 1.7 | producer broker down | event logged; source REST op still succeeds |

## 2. Consumer Semantics

| # | Case | Expected |
|---|------|----------|
| 2.1 | happy consume | row inserted; Redis unread incr; WS push to user room |
| 2.2 | duplicate delivery (same messageId) | second consume skipped (dedup key), no dup row/push |
| 2.3 | poison payload | missing required fields → nack no-requeue → DLQ; app stable |
| 2.4 | transient DB failure | retry ×3 backoff (delay queues) then DLQ; attempts visible in headers |
| 2.5 | ordering caveat | two rapid events for same user may interleave — consumers must not assume order (verify no code does) |
| 2.6 | DLQ backlog alert | >10 messages → warn log fired (monitor cron) |

## 3. REST API

| # | Case | Expected |
|---|------|----------|
| 3.1 | List cursor | seeded 30 → page 20 hasMore; cursor walk completes; newest-first |
| 3.2 | unreadOnly filter | only isRead=false rows |
| 3.3 | Unread count cached | matches SQL count; after mark-read decrements ≥0 floor |
| 3.4 | Count cache miss fallback | delete redis key → endpoint still correct via repo count |
| 3.5 | Mark read ownership | Alice cannot read Bob's notification id → 404/403 |
| 3.6 | read-all | all read; redis counter key cleared; subsequent count=0 |
| 3.7 | Auth | unauthenticated list/count/read → 401 |
| 3.8 | Payload hygiene | responses exclude nothing sensitive but include actor summary fields per DTO |

## 4. Retention & Ops

| # | Case | Expected |
|---|------|----------|
| 4.1 | Cleanup cron | read notifications older than retention purged; unread preserved |
| 4.2 | Queue TTL policy | notification.queue has NO x-message-ttl (messages never silently expire) — assert topology args |
