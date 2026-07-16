# User Handling Data Model

## Scope

This branch adds the user identifiers, ring configuration, and ring notification history required for user handling. It does not add notification delivery, notification workers, or ring-management endpoints.

## User Identifiers

`User.phoneNumber` is unique and required for registration.

## Ring Configuration

Each user owns their own numbered rings. A ring number is unique only for its owner, so separate users can arrange their contacts differently.

```text
User (owner) 1 --- * UserRing 1 --- * UserRingMember * --- 1 User (member)
```

`UserRingMember` has primary key `("ownerId", "memberId")`. A contact can therefore belong to only one ring for that owner, while still belonging to different rings owned by other users. Database checks reject non-positive ring numbers and self-membership.

## Notification History

`UserRingNotification` stores one history row per recipient notified from a ring. It records:

- `ringNumber`
- `senderId`
- `receiverId`
- `riskType`
- `riskLevel`
- `sentAt`

The ring number is a snapshot. A notification remains historically accurate after the sender changes their ring configuration. The table records notification history only; it does not dispatch a push, SMS, or other notification.

## Migration History Repair

The risk and location migration originally sorted before the initial `User` table migration, even though it references `User`. Its directory is renamed from `20260716112453_add_user_risk_location_schema` to `20260716160000_add_user_risk_location_schema`, placing it after the initial and Kafka migrations.

The local database had not applied the misplaced migration, so the repaired order can be deployed normally.
