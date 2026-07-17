import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LivenessCheckActivationMode,
  RiskType,
  UserRisk,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS,
  LIVENESS_CHECK_RISK_AGE_SECONDS_ENV,
} from './liveness-check.constants';

@Injectable()
export class LivenessCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
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
      WHERE ur."riskType" IN (${RiskType.HIGH_RISK_AREA}, ${RiskType.DISASTER})
        AND ur."livenessCheckActivationMode" != ${LivenessCheckActivationMode.OFF}
        AND (n."lastSentAt" IS NULL OR n."lastSentAt" <= NOW() - INTERVAL '1 second' * ${intervalSeconds})
    `;

    return rows;
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
      const result = await this.push.sendLivenessCheck(
        user.userId,
        user.riskType,
      );
      console.log(
        `[liveness-check] ${now.toISOString()} - notification result`,
        {
          userId: user.userId,
          riskType: user.riskType,
          sent: result.sent,
          failed: result.failed,
        },
      );

      if (result.sent > 0) {
        await this.prisma.userRiskNotification.create({
          data: {
            userId: user.userId,
            riskType: user.riskType,
            sentAt: now,
          },
        });
      }
    }
  }

  private riskAgeSeconds(): number {
    return Number(
      this.config.get<string>(LIVENESS_CHECK_RISK_AGE_SECONDS_ENV) ??
        DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS,
    );
  }
}
