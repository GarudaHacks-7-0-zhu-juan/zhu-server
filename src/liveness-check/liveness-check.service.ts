import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RiskType, UserRisk } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS,
  LIVENESS_CHECK_RISK_AGE_SECONDS_ENV,
} from './liveness-check.constants';

type GuardianRiskAlert = {
  guardianId: string;
  guardeeId: string;
  riskType: RiskType;
  riskLevel: UserRisk['riskLevel'];
};

@Injectable()
export class LivenessCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findUsersNeedingCheck(): Promise<UserRisk[]> {
    const intervalSeconds = this.riskAgeSeconds();

    const rows = await this.prisma.$queryRaw<UserRisk[]>`
      SELECT ur.*
      FROM "UserRisk" ur
      LEFT JOIN (
        SELECT "userId", "riskType", MAX("sentAt") AS "lastSentAt"
        FROM "UserRiskNotification"
        GROUP BY "userId", "riskType"
      ) n
        ON n."userId" = ur."userId" AND n."riskType" = ur."riskType"
      WHERE ur."riskType" = 'HIGH_RISK_AREA'
        AND ur."riskLevel" IN ('HIGH', 'CRITICAL')
        AND ur."livenessCheckEnabled" = true
        AND (n."lastSentAt" IS NULL OR n."lastSentAt" <= NOW() - INTERVAL '1 second' * ${intervalSeconds})
    `;

    return rows;
  }

  async findGuardiansNeedingAlert(): Promise<GuardianRiskAlert[]> {
    const intervalSeconds = this.riskAgeSeconds();

    return this.prisma.$queryRaw<GuardianRiskAlert[]>`
      SELECT
        gr."guardianId",
        ur."userId" AS "guardeeId",
        ur."riskType",
        ur."riskLevel"
      FROM "UserRisk" ur
      INNER JOIN "GuardianRelationship" gr
        ON gr."guardeeId" = ur."userId" AND gr."status" = 'ACCEPTED'
      LEFT JOIN (
        SELECT "guardianId", "guardeeId", "riskType", MAX("sentAt") AS "lastSentAt"
        FROM "GuardianRiskNotification"
        GROUP BY "guardianId", "guardeeId", "riskType"
      ) n
        ON n."guardianId" = gr."guardianId"
        AND n."guardeeId" = ur."userId"
        AND n."riskType" = ur."riskType"
      WHERE ur."riskType" = 'HIGH_RISK_AREA'
        AND ur."riskLevel" IN ('HIGH', 'CRITICAL')
        AND ur."livenessCheckEnabled" = true
        AND (n."lastSentAt" IS NULL OR n."lastSentAt" <= NOW() - INTERVAL '1 second' * ${intervalSeconds})
    `;
  }

  async dispatchCheckBatch(): Promise<void> {
    const now = new Date();
    console.log(
      `[liveness-check] ${now.toISOString()} - running liveness check dispatch`,
    );

    const users = await this.findUsersNeedingCheck();

    if (users.length > 0) {
      console.log(
        `[liveness-check] ${now.toISOString()} - ${users.length} user(s) need a liveness check`,
        users.map((u) => ({ userId: u.userId, riskLevel: u.riskLevel })),
      );
    }

    for (const user of users) {
      await this.prisma.userRiskNotification.create({
        data: {
          userId: user.userId,
          riskType: RiskType.HIGH_RISK_AREA,
          sentAt: now,
        },
      });
    }

    const guardianAlerts = await this.findGuardiansNeedingAlert();
    if (guardianAlerts.length > 0) {
      console.log(
        `[guardian-risk-alert] ${now.toISOString()} - ${guardianAlerts.length} guardian alert(s) queued`,
        guardianAlerts,
      );
    }

    for (const alert of guardianAlerts) {
      await this.prisma.guardianRiskNotification.create({
        data: {
          guardianId: alert.guardianId,
          guardeeId: alert.guardeeId,
          riskType: alert.riskType,
          riskLevel: alert.riskLevel,
          sentAt: now,
        },
      });
    }
  }

  private riskAgeSeconds(): number {
    return Number(
      this.config.get<string>(LIVENESS_CHECK_RISK_AGE_SECONDS_ENV) ??
        DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS,
    );
  }
}
