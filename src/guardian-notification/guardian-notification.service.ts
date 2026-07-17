import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuardianRelationshipStatus,
  GuardianRiskNotificationTrigger,
  LivenessCheckActivationMode,
  RiskLevel,
  RiskType,
  UserRisk,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  DEFAULT_GUARDIAN_NOTIFICATION_COOLDOWN_SECONDS,
  DEFAULT_GUARDIAN_NOTIFICATION_RISK_AGE_SECONDS,
  GUARDIAN_NOTIFICATION_COOLDOWN_SECONDS_ENV,
  GUARDIAN_NOTIFICATION_NEGATIVE_RESPONSE_JOB_NAME,
  GUARDIAN_NOTIFICATION_QUEUE,
  GUARDIAN_NOTIFICATION_RISK_AGE_SECONDS_ENV,
} from './guardian-notification.constants';
import { NegativeResponseJob } from './guardian-notification.types';

@Injectable()
export class GuardianNotificationService {
  constructor(
    @InjectQueue(GUARDIAN_NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  async enqueueNegativeResponse(job: NegativeResponseJob): Promise<void> {
    await this.queue.add(
      GUARDIAN_NOTIFICATION_NEGATIVE_RESPONSE_JOB_NAME,
      job,
      {
        jobId: `negative-response-${job.responseEventId}`,
        removeOnComplete: true,
      },
    );
  }

  async dispatchTimeoutAlerts(): Promise<void> {
    const risks = await this.findRisksWithUnansweredCheck();

    for (const risk of risks) {
      await this.notifyGuardians(
        risk.userId,
        risk.riskType,
        GuardianRiskNotificationTrigger.LIVENESS_TIMEOUT,
      );
    }
  }

  async dispatchNegativeResponse(job: NegativeResponseJob): Promise<void> {
    await this.notifyGuardians(
      job.guardeeId,
      job.riskType,
      GuardianRiskNotificationTrigger.NEGATIVE_RESPONSE,
      job.responseEventId,
    );
  }

  async dispatchFallDetected(
    guardeeId: string,
    accidentEventId: string,
  ): Promise<void> {
    await this.notifyGuardians(
      guardeeId,
      RiskType.ACCIDENT,
      GuardianRiskNotificationTrigger.FALL_DETECTED,
      accidentEventId,
    );
  }

  async listForGuardian(guardianId: string, cursor?: string, limit = 20) {
    const notifications = await this.prisma.guardianRiskNotification.findMany({
      where: { guardianId },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        guardee: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });
    const hasMore = notifications.length > limit;
    const items = notifications.slice(0, limit);

    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  private async findRisksWithUnansweredCheck(): Promise<UserRisk[]> {
    const riskAgeSeconds = Number(
      this.config.get<string>(GUARDIAN_NOTIFICATION_RISK_AGE_SECONDS_ENV) ??
        DEFAULT_GUARDIAN_NOTIFICATION_RISK_AGE_SECONDS,
    );

    return this.prisma.$queryRaw<UserRisk[]>`
      SELECT ur.*
      FROM "UserRisk" ur
      JOIN LATERAL (
        SELECT MAX("sentAt") AS "lastSentAt"
        FROM "UserRiskNotification"
        WHERE "userId" = ur."userId" AND "riskType" = ur."riskType"
      ) n ON true
      WHERE ur."riskLevel" IN (${RiskLevel.HIGH}, ${RiskLevel.CRITICAL})
        AND ur."riskType" IN (
          ${RiskType.HIGH_RISK_AREA}::"RiskType",
          ${RiskType.DISASTER}::"RiskType"
        )
        AND ur."livenessCheckActivationMode" != ${LivenessCheckActivationMode.OFF}::"LivenessCheckActivationMode"
        AND n."lastSentAt" <= NOW() - INTERVAL '1 second' * ${riskAgeSeconds}
        AND NOT EXISTS (
          SELECT 1
          FROM "UserRiskEvent" e
          WHERE e."userId" = ur."userId"
            AND e."riskType" = ur."riskType"
            AND e."isOkay" IS NOT NULL
            AND e."detectedAt" > n."lastSentAt"
        )
    `;
  }

  private async notifyGuardians(
    guardeeId: string,
    riskType: RiskType,
    trigger: GuardianRiskNotificationTrigger,
    responseEventId?: string,
  ): Promise<void> {
    const guardians = await this.prisma.guardianRelationship.findMany({
      where: { guardeeId, status: GuardianRelationshipStatus.ACCEPTED },
      select: {
        guardianId: true,
        guardee: {
          select: { displayName: true, email: true, phoneNumber: true },
        },
      },
    });

    for (const { guardianId, guardee } of guardians) {
      if (
        await this.wasRecentlyNotified(
          guardianId,
          guardeeId,
          riskType,
          trigger,
          responseEventId,
        )
      ) {
        continue;
      }

      const notificationId = randomUUID();
      const result = await this.push.sendGuardianRiskNotification(
        guardianId,
        riskType,
        trigger,
        notificationId,
        guardeeId,
        guardee.displayName ?? guardee.email ?? guardee.phoneNumber,
        guardee.displayName ?? undefined,
      );
      if (result.sent === 0) {
        continue;
      }

      await this.prisma.guardianRiskNotification.create({
        data: {
          id: notificationId,
          guardianId,
          guardeeId,
          riskType,
          trigger,
          responseEventId,
          sentAt: new Date(),
        },
      });
    }
  }

  private async wasRecentlyNotified(
    guardianId: string,
    guardeeId: string,
    riskType: RiskType,
    trigger: GuardianRiskNotificationTrigger,
    responseEventId?: string,
  ): Promise<boolean> {
    if (responseEventId) {
      return Boolean(
        await this.prisma.guardianRiskNotification.findUnique({
          where: {
            guardianId_responseEventId: { guardianId, responseEventId },
          },
        }),
      );
    }

    const cooldownSeconds = Number(
      this.config.get<string>(GUARDIAN_NOTIFICATION_COOLDOWN_SECONDS_ENV) ??
        DEFAULT_GUARDIAN_NOTIFICATION_COOLDOWN_SECONDS,
    );
    return Boolean(
      await this.prisma.guardianRiskNotification.findFirst({
        where: {
          guardianId,
          guardeeId,
          riskType,
          trigger,
          sentAt: { gte: new Date(Date.now() - cooldownSeconds * 1000) },
        },
      }),
    );
  }
}
