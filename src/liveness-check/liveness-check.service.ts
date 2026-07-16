import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RiskType, UserRisk } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS,
  LIVENESS_CHECK_RISK_AGE_SECONDS_ENV,
} from './liveness-check.constants';

@Injectable()
export class LivenessCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findUsersNeedingCheck(): Promise<UserRisk[]> {
    const ageSeconds = this.riskAgeSeconds();

    const rows = await this.prisma.$queryRaw`
      SELECT ur.*
      FROM "UserRisk" ur
      LEFT JOIN "UserRiskNotification" n
        ON n."userId" = ur."userId" AND n."riskType" = ur."riskType"
      WHERE ur."riskType" = 'HIGH_RISK_AREA'
        AND ur."riskLevel" IN ('HIGH', 'CRITICAL')
        AND ur."livenessCheckEnabled" = true
        AND ur."updatedAt" <= NOW() - INTERVAL '1 second' * ${ageSeconds}
        AND (n."sentAt" IS NULL OR n."sentAt" < ur."updatedAt")
    `;

    return rows;
  }

  async dispatchCheckBatch(): Promise<void> {
    const users = await this.findUsersNeedingCheck();
    const now = new Date();

    if (users.length > 0) {
      console.log(
        `[liveness-check] ${users.length} user(s) need a liveness check`,
        users.map((u) => ({ userId: u.userId, riskLevel: u.riskLevel })),
      );
    }

    for (const user of users) {
      await this.prisma.userRiskNotification.upsert({
        where: {
          userId_riskType: {
            userId: user.userId,
            riskType: RiskType.HIGH_RISK_AREA,
          },
        },
        create: {
          userId: user.userId,
          riskType: RiskType.HIGH_RISK_AREA,
          sentAt: now,
        },
        update: {
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
