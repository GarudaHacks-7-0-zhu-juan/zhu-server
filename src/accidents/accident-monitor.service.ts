import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RiskLevel, RiskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import {
  ACCIDENT_NO_MOVEMENT_HOURS_ENV,
  DEFAULT_ACCIDENT_NO_MOVEMENT_HOURS,
} from './accidents.constants';
import { AccidentMonitorResult } from './accidents.types';

interface UnprocessedFall {
  userId: string;
  detectedAt: Date;
}

interface StaleMovementUser {
  userId: string;
  lastMovementAt: Date;
}

@Injectable()
export class AccidentMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRisks: UserRisksService,
    private readonly config: ConfigService,
  ) {}

  async monitor(): Promise<AccidentMonitorResult> {
    const startedAt = new Date();
    console.log(
      `[accident-monitor] ${startedAt.toISOString()} - running accident monitor`,
    );

    const falls = await this.findUnprocessedFalls();
    let fallDetectedCount = 0;

    for (const fall of falls) {
      await this.userRisks.setAccidentRisk(
        fall.userId,
        RiskLevel.CRITICAL,
        fall.detectedAt,
      );
      fallDetectedCount++;
      console.log(
        `[accident-monitor] ${startedAt.toISOString()} - ` +
          `fall detected for user ${fall.userId}, risk set to CRITICAL`,
      );
    }

    const staleMovementUsers = await this.findStaleMovementUsers();
    let noMovementCount = 0;

    for (const stale of staleMovementUsers) {
      const shouldFlag = await this.shouldFlagForNoMovement(stale.userId);
      if (!shouldFlag) {
        continue;
      }

      await this.userRisks.setAccidentRisk(
        stale.userId,
        RiskLevel.HIGH,
        startedAt,
      );
      noMovementCount++;
      console.log(
        `[accident-monitor] ${startedAt.toISOString()} - ` +
          `no movement for user ${stale.userId} since ${stale.lastMovementAt.toISOString()}, ` +
          `risk set to HIGH`,
      );
    }

    return { fallDetectedCount, noMovementCount };
  }

  private async findUnprocessedFalls(): Promise<UnprocessedFall[]> {
    return this.prisma.$queryRaw<UnprocessedFall[]>`
      SELECT e."userId", MAX(e."detectedAt") AS "detectedAt"
      FROM "UserAccidentEvent" e
      LEFT JOIN "UserRisk" ur
        ON ur."userId" = e."userId" AND ur."riskType" = 'ACCIDENT'
      WHERE e."eventType" = 'FALL_DETECTED'
        AND (ur."updatedAt" IS NULL OR ur."updatedAt" < e."detectedAt")
      GROUP BY e."userId"
    `;
  }

  private async findStaleMovementUsers(): Promise<StaleMovementUser[]> {
    const hours = this.noMovementHours();

    return this.prisma.$queryRaw<StaleMovementUser[]>`
      SELECT e."userId", MAX(e."detectedAt") AS "lastMovementAt"
      FROM "UserAccidentEvent" e
      WHERE e."eventType" = 'MOVEMENT'
      GROUP BY e."userId"
      HAVING MAX(e."detectedAt") <= NOW() - INTERVAL '1 hour' * ${hours}
    `;
  }

  private async shouldFlagForNoMovement(userId: string): Promise<boolean> {
    const risk = await this.prisma.userRisk.findUnique({
      where: {
        userId_riskType: {
          userId,
          riskType: RiskType.ACCIDENT,
        },
      },
    });

    if (!risk) {
      return true;
    }

    if (this.isHighOrCritical(risk.riskLevel)) {
      return false;
    }

    const hours = this.noMovementHours();
    const gracePeriodAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    return risk.updatedAt <= gracePeriodAgo;
  }

  private noMovementHours(): number {
    return Number(
      this.config.get<string>(ACCIDENT_NO_MOVEMENT_HOURS_ENV) ??
        DEFAULT_ACCIDENT_NO_MOVEMENT_HOURS,
    );
  }

  private isHighOrCritical(riskLevel: RiskLevel): boolean {
    return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
  }
}
