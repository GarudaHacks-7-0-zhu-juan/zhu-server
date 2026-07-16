# Repository Guide

## Setup And Verification

- This is a single NestJS API. `src/main.ts` starts it at `/api` on `PORT` (default `3000`); `src/app.module.ts` wires Prisma, Redis, BullMQ, Kafka, and auth.
- Bootstrap local dependencies before running the app or e2e suite: `cp .env.example .env`, `docker compose up -d --wait`, then `npm run prisma:migrate:deploy`. Compose exposes PostgreSQL (`5432`), Redis (`6379`), and Kafka (`9092`).
- Use `npm run build` for the TypeScript/Nest build and `npm test -- --runInBand` for unit tests. The e2e suite requires the Compose services: `npm run test:e2e -- --runInBand --detectOpenHandles`.
- Run only the Kafka integration test with `npm run test:e2e -- --runInBand test/kafka.e2e-spec.ts`.
- `npm run lint` runs ESLint with `--fix`; inspect its resulting diff before committing. Prettier uses single quotes and trailing commas.

## Data And Events

- Prisma schema and committed migrations live under `prisma/`. Use `npm run prisma:migrate` to create development migrations; use `prisma:migrate:deploy` only to apply committed migrations.
- Redis Pub/Sub and BullMQ are infrastructure only: no product channels, queues, or workers are registered yet.
- Kafka provisions `user-events.v1` with 12 partitions. User events must use `userId` as the Kafka message key and a positive per-user `sequence`; do not change the partition count casually because user ordering depends on its current partition mapping.
- `UserEventOutbox` and `ProcessedUserEvent` reserve the Prisma persistence needed for future transactional outbox dispatching and consumer checkpoints; the current Kafka test publishes only test events.
