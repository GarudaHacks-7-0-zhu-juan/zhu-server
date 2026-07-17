# ProtectMe Server

Backend for **ProtectMe**, a proactive personal-safety network for Jakarta. ProtectMe combines
consented location sharing, explainable district-level safety data, automatic check-ins,
and trusted guardians so a user can receive support before a situation becomes an emergency.

## What ProtectMe Does

- Authenticates users and manages access/refresh tokens.
- Ingests authenticated user locations and stores the latest location plus history.
- Publishes ordered `user.location.updated` events through a transactional outbox and Kafka.
- Evaluates location events against 44 Jakarta kecamatan risk polygons.
- Activates liveness checks when a user enters a `HIGH` or `CRITICAL` area.
- Escalates negative or unanswered liveness checks to accepted guardians.
- Handles fall events and configured inactivity monitoring.
- Polls BMKG earthquake data when enabled.
- Delivers Android push notifications through Firebase Cloud Messaging when enabled.

ProtectMe is a safety-support system, not a replacement for emergency services. The risk map is a

## Architecture

```text
Flutter app
    |
    v
NestJS API
    |
    +--> PostgreSQL / Prisma
    |       +--> users, locations, guardians, risks, audit events
    |       +--> transactional user-event outbox
    |
    +--> Outbox dispatcher --> Kafka user-events.v1
                                  |
                                  v
                         LocationConsumerService
                                  |
                                  v
                         RiskGeoService
                         GeoJSON point lookup
                                  |
                                  v
                         UserRisk + UserRiskEvent
                                  |
                                  v
                         BullMQ / Redis liveness jobs
                                  |
                                  v
                         Guardian notifications / FCM
```

The HTTP location endpoint persists the location and publishes an event. High-risk-area
evaluation is performed by `LocationConsumerService`, not synchronously by the HTTP request.
Kafka messages use `userId` as their key to preserve per-user ordering. Consumer processing is
idempotent through `ProcessedUserEvent` sequence checkpoints and audited through `UserRiskEvent`.

## Risk Map

The pinned runtime artifact is:

```text
src/risk-geo/data/kecamatan_boundaries.geojson
```

It contains 44 Jakarta kecamatan as WGS84 GeoJSON `MultiPolygon` features. GeoJSON coordinates
use `[longitude, latitude]`; API input uses `{ latitude, longitude }`, so the lookup converts the
order before testing containment.

Current policy:

```text
jakarta-kecamatan-v2
```

The data pipeline calculates:

```text
risk_score =
  0.50 * percentile(public_safety_points)
+ 0.30 * percentile(public_safety_points_per_100k)
+ 0.20 * percentile(public_safety_evening_points)
```

Risk levels are `NONE`, `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`. A coordinate outside the
available polygons receives `NONE` with `outsideCoverage=true`. This means the system has no
matching data, not that the location is proven safe.

The artifact is validated at application startup for feature count, geometry type, score range,
risk levels, and policy version. It is copied into `dist/` by the Nest build configuration.

To refresh the artifact:

1. Refresh and validate the source data in the `zhu-data` repository.
2. Copy the new `data/kecamatan_boundaries.geojson` into this repository’s
   `src/risk-geo/data/` directory.
3. Run the server tests and build.
4. Deploy the server and pinned artifact together.

## Event Flow

### Location update

`POST /api/locations`:

1. Validates latitude and longitude.
2. Upserts the user’s latest `UserLocation`.
3. Appends a `UserLocationEvent`.
4. Creates a `user.location.updated` `UserEventOutbox` record.
5. Returns the persisted location and event.

The new risk result is asynchronous. The Kafka consumer then:

1. Validates the event payload and sequence.
2. Ignores non-location events.
3. Ignores duplicate or older events for the consumer group.
4. Performs GeoJSON point-in-polygon evaluation.
5. Upserts the user’s `HIGH_RISK_AREA` risk.
6. Appends an auditable `UserRiskEvent`.
7. Checkpoints the processed event only after risk persistence succeeds.

### Risk audit

Location-based risk events record:

- source `locationEventId`
- district, when covered
- risk score, when covered
- risk policy version
- calculated risk level
- `outsideCoverage`
- detection timestamp

## API Overview

All routes are prefixed with `/api`. Authenticated routes require:

```http
Authorization: Bearer <access-token>
```

### Authentication

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/refresh` | Refresh access tokens |
| `POST` | `/api/auth/logout` | Revoke the refresh token |
| `GET` | `/api/auth/me` | Read the authenticated token user |

### Safety and location

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/locations` | Store a location and publish a Kafka event |
| `GET` | `/api/user-risks/liveness-check` | Read liveness status for Protect Me risk types |
| `PATCH` | `/api/user-risks/:riskType/liveness-check` | Enable or disable manual liveness checks |
| `POST` | `/api/user-risks/:riskType/liveness-check/respond` | Respond to a liveness check |
| `POST` | `/api/accidents` | Submit an accident/fall event |

Example location request:

```http
POST /api/locations
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "latitude": -6.1627,
  "longitude": 106.85582
}
```

The response confirms location persistence and event creation. The corresponding area-risk
decision is made asynchronously by Kafka.

### Trusted circle and notifications

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/guardians/requests` | Request a guardian relationship |
| `GET` | `/api/guardians/requests` | List guardian requests |
| `PATCH` | `/api/guardians/requests/:guardianId` | Respond to a guardian request |
| `GET` | `/api/guardians` | List guardians |
| `DELETE` | `/api/guardians/:guardianId` | Remove a guardian |
| `POST` | `/api/guardees/requests` | Request a guardee relationship |
| `GET` | `/api/guardees/requests` | List guardee requests |
| `PATCH` | `/api/guardees/requests/:guardeeId` | Respond to a guardee request |
| `GET` | `/api/guardees` | List guardees |
| `GET` | `/api/guardees/:guardeeId` | Read a guardee safety view |
| `DELETE` | `/api/guardees/:guardeeId` | Remove a guardee |
| `GET` | `/api/guardian-notifications` | List guardian risk notifications |
| `POST` | `/api/push/devices` | Register an FCM device |
| `DELETE` | `/api/push/devices/:registrationToken` | Remove an FCM device |

Push test endpoints exist for development and remain guarded by `FCM_TEST_SEND_ENABLED`.

## Technology

- Node.js 22.x
- TypeScript and NestJS 11
- Prisma 6 and PostgreSQL 16
- Apache Kafka and KafkaJS
- Redis and BullMQ
- Firebase Admin / FCM
- Turf point-in-polygon
- Jest and Supertest
- Docker Compose for local PostgreSQL, Redis, and Kafka

## Local Development

### Prerequisites

- Node.js `22.x`
- npm
- Docker and Docker Compose

### Setup

```bash
cp .env.example .env
npm install
docker compose up -d --wait
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

The local services use these ports:

| Service | Port |
|---|---:|
| API | `3000` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| Kafka | `9092` |

Stop local infrastructure with:

```bash
docker compose down
```

Use `docker compose down --volumes` only when intentionally deleting local database, Redis,
and Kafka data.

## Configuration

Copy `.env.example` to `.env` and set environment-specific values. Important settings include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `KAFKA_BROKERS` | Comma-separated Kafka brokers |
| `KAFKA_USER_EVENTS_TOPIC` | User event topic, normally `user-events.v1` |
| `KAFKA_USER_EVENTS_PARTITIONS` | Topic partition count; ordering depends on this layout |
| `KAFKA_LOCATION_CONSUMER_ENABLED` | Enable the location risk consumer |
| `KAFKA_LOCATION_CONSUMER_GROUP` | Consumer checkpoint group |
| `FCM_ENABLED` | Enable Firebase push delivery |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase credentials outside the repository |
| `GUARDIAN_NOTIFICATION_ENABLED` | Enable guardian notification worker |
| `EARTHQUAKE_POLLING_ENABLED` | Enable BMKG polling |
| `ACCIDENT_MONITOR_ENABLED` | Enable accident/inactivity monitoring |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret |
| `PORT` | API port, default `3000` |

For a full demo with asynchronous location-risk evaluation, enable at least:

```env
KAFKA_LOCATION_CONSUMER_ENABLED=true
KAFKA_LOCATION_CONSUMER_GROUP=location-worker
```

FCM, guardian notifications, earthquake polling, and accident monitoring are independently
configurable. Never commit `.env`, Firebase credentials, JWT secrets, or device tokens.

## Database

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply committed migrations:

```bash
npm run prisma:migrate:deploy
```

Create a development migration after changing `prisma/schema.prisma`:

```bash
npm run prisma:migrate
```

Open Prisma Studio locally:

```bash
npm run prisma:studio
```

Production deployments should apply committed migrations with `prisma:migrate:deploy`, not create
new migrations on the server.

## Testing And Verification

Run the unit suite:

```bash
npm test -- --runInBand
```

Run the build:

```bash
npm run build
```

Run end-to-end tests after starting Docker Compose and applying migrations:

```bash
npm run test:e2e -- --runInBand --detectOpenHandles
```

Run only the Kafka integration test:

```bash
npm run test:e2e -- --runInBand test/kafka.e2e-spec.ts
```

The risk-map tests verify the pinned artifact, known Jakarta containment, outside-coverage
behavior, policy version, and score metadata.

## Deployment

The production service runs under systemd using `deploy/zhu-server.service` and starts:

```bash
node dist/main
```

Typical deployment sequence:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run build
sudo systemctl restart zhu-server
sudo systemctl status zhu-server
```

The build must include:

```text
dist/risk-geo/data/kecamatan_boundaries.geojson
```

The pinned artifact and server code should be deployed together. If the risk-data repository
produces a new policy version, update the artifact, run the risk-map contract tests, and deploy
the new version deliberately.

## Repository Structure

```text
src/
  auth/                   JWT registration and authentication
  locations/              Location persistence and outbox events
  location-consumer/      Kafka location-risk consumer
  risk-geo/               Pinned GeoJSON risk lookup
  user-risks/             Risk persistence and liveness activation
  guardians/              Guardian/guardee relationships
  liveness-check/         Check-in scheduling and processing
  guardian-notification/  Guardian alert workflow
  accidents/              Accident and inactivity monitoring
  earthquake/             BMKG polling and disaster risk
  push/                   FCM device registration and delivery
  outbox/                 Transactional outbox dispatch
  kafka/                  Kafka producer and consumer infrastructure
  prisma/                 Prisma service module
prisma/
  schema.prisma
  migrations/
deploy/
  zhu-server.service
```

## Safety And Privacy Notes

- Location sharing is opt-in and should be clearly communicated to users.
- Location history is sensitive data and requires an explicit retention and access policy.
- Guardian relationships should be accepted by the relevant user before sharing safety data.
- Risk levels are district-level relative signals, not definitive claims about a person’s safety.
- Outside-coverage `NONE` means no matching polygon was found; it does not mean the location is safe.
- Push notifications depend on configured FCM credentials and registered devices.
- Alerts should contain only the minimum information needed to help a guardian respond.

## Related Repositories

- `zhu-data`: source ingestion, crime-type severity mapping, risk scoring, GeoJSON generation, and visualization.
- `zhu-app`: Flutter mobile client.
- `mock-bmkg`: configurable BMKG mock service for demonstrations and development.
