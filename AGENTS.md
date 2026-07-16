# Repository Guide

## Setup And Verification

- This is a single NestJS API. `src/main.ts` starts it at `/api` on `PORT` (default `3000`); `src/app.module.ts` wires Prisma, Redis, BullMQ, Kafka, and auth.
- Bootstrap local dependencies before running the app or e2e suite: `cp .env.example .env`, `docker compose up -d --wait`, then `npm run prisma:migrate:deploy`. Compose exposes PostgreSQL (`5432`), Redis (`6379`), and Kafka (`9092`).
- Use `npm run build` for the TypeScript/Nest build and `npm test -- --runInBand` for unit tests. The e2e suite requires the Compose services: `npm run test:e2e -- --runInBand --detectOpenHandles`.
- Run only the Kafka integration test with `npm run test:e2e -- --runInBand test/kafka.e2e-spec.ts`.
- `npm run lint` runs ESLint with `--fix`; inspect its resulting diff before committing. Prettier uses single quotes and trailing commas.
- Firebase Admin requires Node.js 22 or newer. CI and the VPS systemd runtime
  must use a compatible Node version.

## Data And Events

- Prisma schema and committed migrations live under `prisma/`. Use `npm run prisma:migrate` to create development migrations; use `prisma:migrate:deploy` only to apply committed migrations.
- Redis Pub/Sub and BullMQ are infrastructure only: no product channels, queues, or workers are registered yet.
- Kafka provisions `user-events.v1` with 12 partitions. User events must use `userId` as the Kafka message key and a positive per-user `sequence`; do not change the partition count casually because user ordering depends on its current partition mapping.
- `UserEventOutbox` and `ProcessedUserEvent` reserve the Prisma persistence needed for future transactional outbox dispatching and consumer checkpoints; the current Kafka test publishes only test events.

## Push Notifications

- Push delivery is currently Android-only and uses FCM registration tokens for
  hackathon reliability. Keep one active token per user and update it from the
  client token-refresh stream.
- Firebase Admin uses Application Default Credentials. Enable it with
  `FCM_ENABLED`, set `FIREBASE_PROJECT_ID`, and point
  `GOOGLE_APPLICATION_CREDENTIALS` to a key outside the repository. Never log
  credentials or complete registration tokens.
- Device endpoints are authenticated and derive ownership from
  `request.user.sub`; never accept a user ID from the request body. Registration
  is an idempotent token upsert that transfers ownership during account changes.
- Keep Firebase SDK access behind `FirebaseMessagingGateway`. Business modules
  should call an application-level push service rather than importing
  `getMessaging()` or duplicating payload/error handling.
- FCM data values must be strings. Keep payloads small and non-sensitive, use
  stable allowlisted event types/routes, and treat the database/API as source of
  truth for notification actions.
- Keep Android channel ID `high_importance_channel` aligned with the Flutter
  client. Notification-plus-data messages are the default for visible alerts;
  the liveness action test is an explicit high-priority data-only exception.
- Fan-out must isolate per-device failures. Keep failed tokens enabled during the
  hackathon demo and log only the Firebase error code for diagnosis; never log
  complete registration tokens or Firebase error messages.
- `POST /api/push/test` and `/api/push/test/liveness-check` are self-targeted and
  must remain behind `FCM_TEST_SEND_ENABLED`. Keep Firebase disabled in ordinary
  unit tests and use injected fakes for gateway/service behavior.
- Any `PushDevice` schema change requires a committed Prisma migration. Keep one
  active token per user and preserve scoped unregister semantics.
