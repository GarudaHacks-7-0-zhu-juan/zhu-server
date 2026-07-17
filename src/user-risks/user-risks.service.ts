import { BadRequestException, Injectable } from '@nestjs/common';
import {
  LivenessCheckActivationMode,
  RiskLevel,
  RiskType,
  UserRisk,
  UserRiskEvent,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RiskGeoService } from '../risk-geo/risk-geo.service';

export const protectMeRiskTypes = [
  RiskType.HIGH_RISK_AREA,
  RiskType.DISASTER,
] as const;

@Injectable()
export class UserRisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskGeo: RiskGeoService,
  ) {}

  async evaluateLocationRisk(
    userId: string,
    latitude: number,
    longitude: number,
    detectedAt: Date,
    consumerGroup: string,
    eventId: string,
    sequence: number,
    locationEventId: string,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent } | null> {
    return this.prisma.$transaction(async (tx) => {
      const processed = await tx.processedUserEvent.findUnique({
        where: { consumerGroup_userId: { consumerGroup, userId } },
      });
      if (processed && processed.sequence >= sequence) return null;
      const assessment = this.riskGeo.evaluate(latitude, longitude);
      const existingRisk = await tx.userRisk.findUnique({
      where: {
        userId_riskType: { userId, riskType: RiskType.HIGH_RISK_AREA },
      },
      });
      const activationMode = this.locationActivationMode(existingRisk, assessment.riskLevel);

      const risk = await tx.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.HIGH_RISK_AREA,
          },
        },
        create: {
          userId,
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: assessment.riskLevel,
          livenessCheckActivationMode: activationMode,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel: assessment.riskLevel,
          livenessCheckActivationMode: activationMode,
          updatedAt: detectedAt,
        },
      });
      const event = await tx.userRiskEvent.create({
        data: {
          userId,
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: assessment.riskLevel,
          detectedAt,
          locationEventId,
          district: assessment.district,
          riskScore: assessment.riskScore,
          riskPolicyVersion: assessment.riskPolicyVersion,
          outsideCoverage: assessment.outsideCoverage,
        },
      });
      await tx.processedUserEvent.upsert({
        where: { consumerGroup_userId: { consumerGroup, userId } },
        create: { consumerGroup, userId, sequence, eventId },
        update: { sequence, eventId, processedAt: new Date() },
      });

      return { risk, event };
    });
  }

  async setLivenessCheckEnabled(
    userId: string,
    riskType: RiskType,
    enabled: boolean,
  ): Promise<UserRisk> {
    this.assertProtectMeRiskType(riskType);
    return this.prisma.userRisk.upsert({
      where: {
        userId_riskType: {
          userId,
          riskType,
        },
      },
      create: {
        userId,
        riskType,
        riskLevel: RiskLevel.NONE,
        livenessCheckActivationMode: enabled
          ? LivenessCheckActivationMode.MANUAL
          : LivenessCheckActivationMode.OFF,
        updatedAt: new Date(),
      },
      update: {
        livenessCheckActivationMode: enabled
          ? LivenessCheckActivationMode.MANUAL
          : LivenessCheckActivationMode.OFF,
      },
    });
  }

  async getLivenessCheckStatuses(
    userId: string,
  ): Promise<
    Pick<UserRisk, 'riskType' | 'riskLevel' | 'livenessCheckActivationMode'>[]
  > {
    const risks = await this.prisma.userRisk.findMany({
      where: { userId },
      select: {
        riskType: true,
        riskLevel: true,
        livenessCheckActivationMode: true,
      },
    });

    const byRiskType = new Map(risks.map((risk) => [risk.riskType, risk]));
    return protectMeRiskTypes.map(
      (riskType) =>
        byRiskType.get(riskType) ?? {
          riskType,
          riskLevel: RiskLevel.NONE,
          livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
        },
    );
  }

  async setDisasterRisk(
    userId: string,
    riskLevel: RiskLevel,
    detectedAt: Date,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.DISASTER,
          },
        },
        create: {
          userId,
          riskType: RiskType.DISASTER,
          riskLevel,
          livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel,
          livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
          updatedAt: detectedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType: RiskType.DISASTER,
          riskLevel,
          detectedAt,
        },
      }),
    ]);

    return { risk, event };
  }

  async setAccidentRisk(
    userId: string,
    riskLevel: RiskLevel,
    detectedAt: Date,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.ACCIDENT,
          },
        },
        create: {
          userId,
          riskType: RiskType.ACCIDENT,
          riskLevel,
          livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel,
          livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
          updatedAt: detectedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType: RiskType.ACCIDENT,
          riskLevel,
          detectedAt,
        },
      }),
    ]);

    return { risk, event };
  }

  async respondToLivenessCheck(
    userId: string,
    riskType: RiskType,
    isOkay: boolean,
  ): Promise<{ risk: UserRisk; event: UserRiskEvent }> {
    this.assertRespondableRiskType(riskType);
    const respondedAt = new Date();
    const existingRisk = await this.prisma.userRisk.findUnique({
      where: { userId_riskType: { userId, riskType } },
    });
    const riskLevel = isOkay
      ? RiskLevel.NONE
      : (existingRisk?.riskLevel ?? RiskLevel.NONE);
    const activationMode =
      existingRisk?.livenessCheckActivationMode ??
      LivenessCheckActivationMode.OFF;

    const [risk, event] = await this.prisma.$transaction([
      this.prisma.userRisk.upsert({
        where: {
          userId_riskType: {
            userId,
            riskType,
          },
        },
        create: {
          userId,
          riskType,
          riskLevel,
          livenessCheckActivationMode: activationMode,
          updatedAt: respondedAt,
        },
        update: {
          riskLevel,
          livenessCheckActivationMode: activationMode,
          updatedAt: respondedAt,
        },
      }),
      this.prisma.userRiskEvent.create({
        data: {
          userId,
          riskType,
          riskLevel,
          detectedAt: respondedAt,
          isOkay,
        },
      }),
    ]);

    return { risk, event };
  }

  private isHighOrCritical(riskLevel: RiskLevel): boolean {
    return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
  }

  private locationActivationMode(
    existingRisk: UserRisk | null,
    riskLevel: RiskLevel,
  ): LivenessCheckActivationMode {
    const wasHighRisk = this.isHighOrCritical(
      existingRisk?.riskLevel ?? RiskLevel.NONE,
    );
    const isHighRisk = this.isHighOrCritical(riskLevel);
    const existingMode =
      existingRisk?.livenessCheckActivationMode ??
      LivenessCheckActivationMode.OFF;

    if (isHighRisk && !wasHighRisk) {
      return LivenessCheckActivationMode.AUTO;
    }
    if (!isHighRisk && existingMode === LivenessCheckActivationMode.AUTO) {
      return LivenessCheckActivationMode.OFF;
    }
    return existingMode;
  }

  private assertProtectMeRiskType(riskType: RiskType): void {
    if (
      !protectMeRiskTypes.includes(
        riskType as (typeof protectMeRiskTypes)[number],
      )
    ) {
      throw new BadRequestException('Risk type does not support Protect Me.');
    }
  }

  private assertRespondableRiskType(riskType: RiskType): void {
    if (riskType === RiskType.ACCIDENT) return;
    this.assertProtectMeRiskType(riskType);
  }
}
