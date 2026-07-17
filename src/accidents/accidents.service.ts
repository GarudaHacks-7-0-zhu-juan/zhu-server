import { Injectable } from '@nestjs/common';
import {
  AccidentEventType,
  RiskLevel,
  RiskType,
  UserAccidentEvent,
} from '@prisma/client';
import { GuardianNotificationService } from '../guardian-notification/guardian-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import { CreateAccidentEventInput } from './accidents.types';

@Injectable()
export class AccidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRisks: UserRisksService,
    private readonly push: PushService,
    private readonly guardianNotifications: GuardianNotificationService,
  ) {}

  async recordEvent(
    input: CreateAccidentEventInput,
  ): Promise<UserAccidentEvent> {
    return this.prisma.userAccidentEvent.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        detectedAt: input.detectedAt,
      },
    });
  }

  async recordMovement(
    userId: string,
    detectedAt: Date,
  ): Promise<UserAccidentEvent> {
    return this.recordEvent({
      userId,
      eventType: AccidentEventType.MOVEMENT,
      detectedAt,
    });
  }

  async recordFall(
    userId: string,
    detectedAt: Date,
  ): Promise<UserAccidentEvent> {
    const event = await this.recordEvent({
      userId,
      eventType: AccidentEventType.FALL_DETECTED,
      detectedAt,
    });

    await this.userRisks.setAccidentRisk(
      userId,
      RiskLevel.CRITICAL,
      detectedAt,
    );
    await this.push.sendLivenessCheck(userId, RiskType.ACCIDENT);
    await this.guardianNotifications.dispatchFallDetected(userId, event.id);

    return event;
  }
}
