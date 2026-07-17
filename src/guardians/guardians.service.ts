import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GuardianRelationshipInitiatorRole,
  GuardianRelationshipStatus,
  GuardianRiskNotificationTrigger,
  LivenessCheckActivationMode,
  RiskLevel,
  RiskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const userSummary = {
  id: true,
  email: true,
  phoneNumber: true,
} as const;

type GuardeeSafetyData = {
  risks: Array<{
    riskType: RiskType;
    riskLevel: RiskLevel;
    updatedAt: Date;
    livenessCheckActivationMode: LivenessCheckActivationMode;
  }>;
  guardianRiskNotificationsReceived: Array<{
    riskType: RiskType;
    trigger: GuardianRiskNotificationTrigger;
    sentAt: Date;
  }>;
};

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  async requestGuardian(guardeeId: string, phoneNumber: string) {
    const guardian = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: userSummary,
    });
    if (!guardian) {
      throw new NotFoundException('Guardian contact was not found');
    }
    if (guardian.id === guardeeId) {
      throw new BadRequestException('A user cannot be their own guardian');
    }

    return this.requestRelationship(
      guardian.id,
      guardeeId,
      GuardianRelationshipInitiatorRole.GUARDEE,
      'guardian',
    );
  }

  async requestGuardee(guardianId: string, phoneNumber: string) {
    const guardee = await this.prisma.user.findUnique({
      where: { phoneNumber },
      select: userSummary,
    });
    if (!guardee) {
      throw new NotFoundException('Guardee contact was not found');
    }
    if (guardee.id === guardianId) {
      throw new BadRequestException('A user cannot be their own guardee');
    }

    return this.requestRelationship(
      guardianId,
      guardee.id,
      GuardianRelationshipInitiatorRole.GUARDIAN,
      'guardee',
    );
  }

  private async requestRelationship(
    guardianId: string,
    guardeeId: string,
    initiatorRole: GuardianRelationshipInitiatorRole,
    counterpart: 'guardian' | 'guardee',
  ) {
    const existing = await this.prisma.guardianRelationship.findUnique({
      where: { guardianId_guardeeId: { guardianId, guardeeId } },
    });
    if (existing?.status === GuardianRelationshipStatus.ACCEPTED) {
      throw new ConflictException('Guardian relationship already exists');
    }

    const now = new Date();
    return this.prisma.guardianRelationship.upsert({
      where: { guardianId_guardeeId: { guardianId, guardeeId } },
      create: { guardianId, guardeeId, initiatorRole },
      update: {
        status: GuardianRelationshipStatus.PENDING,
        initiatorRole,
        requestedAt: now,
        respondedAt: null,
      },
      include:
        counterpart === 'guardian'
          ? { guardian: { select: userSummary } }
          : { guardee: { select: userSummary } },
    });
  }

  listGuardians(guardeeId: string) {
    return this.prisma.guardianRelationship.findMany({
      where: { guardeeId, status: GuardianRelationshipStatus.ACCEPTED },
      orderBy: { requestedAt: 'desc' },
      include: { guardian: { select: userSummary } },
    });
  }

  async removeGuardian(guardeeId: string, guardianId: string): Promise<void> {
    const result = await this.prisma.guardianRelationship.deleteMany({
      where: { guardianId, guardeeId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Guardian relationship not found');
    }
  }

  listGuardianRequests(guardeeId: string) {
    return this.prisma.guardianRelationship.findMany({
      where: {
        guardeeId,
        status: {
          in: [
            GuardianRelationshipStatus.PENDING,
            GuardianRelationshipStatus.DECLINED,
          ],
        },
      },
      orderBy: { requestedAt: 'asc' },
      include: { guardian: { select: userSummary } },
    });
  }

  listGuardeeRequests(guardianId: string) {
    return this.prisma.guardianRelationship.findMany({
      where: {
        guardianId,
        status: {
          in: [
            GuardianRelationshipStatus.PENDING,
            GuardianRelationshipStatus.DECLINED,
          ],
        },
      },
      orderBy: { requestedAt: 'asc' },
      include: { guardee: { select: userSummary } },
    });
  }

  respondToRequest(
    guardianId: string,
    guardeeId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    return this.respondToRelationshipRequest(
      guardianId,
      guardeeId,
      GuardianRelationshipInitiatorRole.GUARDIAN,
      status,
      'guardee',
    );
  }

  respondToGuardianRequest(
    guardeeId: string,
    guardianId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ) {
    return this.respondToRelationshipRequest(
      guardianId,
      guardeeId,
      GuardianRelationshipInitiatorRole.GUARDEE,
      status,
      'guardian',
    );
  }

  private async respondToRelationshipRequest(
    guardianId: string,
    guardeeId: string,
    recipientRole: GuardianRelationshipInitiatorRole,
    status: 'ACCEPTED' | 'DECLINED',
    counterpart: 'guardian' | 'guardee',
  ) {
    if (
      status !== GuardianRelationshipStatus.ACCEPTED &&
      status !== GuardianRelationshipStatus.DECLINED
    ) {
      throw new BadRequestException(
        'Guardian request status must be accepted or declined',
      );
    }

    const relationship = await this.prisma.guardianRelationship.findUnique({
      where: { guardianId_guardeeId: { guardianId, guardeeId } },
    });
    if (!relationship) {
      throw new NotFoundException('Guardian request not found');
    }
    if (relationship.status !== GuardianRelationshipStatus.PENDING) {
      throw new ConflictException('Guardian request has already been resolved');
    }
    if (relationship.initiatorRole === recipientRole) {
      throw new ForbiddenException(
        'Only the guardian request recipient can respond',
      );
    }

    return this.prisma.guardianRelationship.update({
      where: { guardianId_guardeeId: { guardianId, guardeeId } },
      data: { status, respondedAt: new Date() },
      include:
        counterpart === 'guardian'
          ? { guardian: { select: userSummary } }
          : { guardee: { select: userSummary } },
    });
  }

  async listGuardees(guardianId: string) {
    const relationships = await this.prisma.guardianRelationship.findMany({
      where: { guardianId, status: GuardianRelationshipStatus.ACCEPTED },
      orderBy: { updatedAt: 'desc' },
      include: { guardee: { select: this.guardeeSelection(guardianId) } },
    });

    return relationships.map(
      ({
        guardee: { risks, guardianRiskNotificationsReceived, ...guardee },
        ...relationship
      }) => ({
        ...relationship,
        guardee,
        location: guardee.location,
        ...this.deriveSafetyStatus({
          risks,
          guardianRiskNotificationsReceived,
        }),
      }),
    );
  }

  async getGuardeeDetail(guardianId: string, guardeeId: string) {
    const relationship = await this.prisma.guardianRelationship.findFirst({
      where: {
        guardianId,
        guardeeId,
        status: GuardianRelationshipStatus.ACCEPTED,
      },
      include: {
        guardee: {
          select: this.guardeeSelection(guardianId),
        },
      },
    });
    if (!relationship) {
      throw new NotFoundException('Accepted guardian relationship not found');
    }

    const { risks, guardianRiskNotificationsReceived, ...guardee } =
      relationship.guardee;

    return {
      guardee,
      location: guardee.location,
      ...this.deriveSafetyStatus({ risks, guardianRiskNotificationsReceived }),
    };
  }

  private guardeeSelection(guardianId: string) {
    return {
      ...userSummary,
      location: true,
      risks: {
        select: {
          riskType: true,
          riskLevel: true,
          updatedAt: true,
          livenessCheckActivationMode: true,
        },
      },
      guardianRiskNotificationsReceived: {
        where: { guardianId },
        orderBy: { sentAt: 'desc' as const },
        take: 1,
        select: {
          riskType: true,
          trigger: true,
          sentAt: true,
        },
      },
    };
  }

  private deriveSafetyStatus(guardee: GuardeeSafetyData) {
    const latestNotification = guardee.guardianRiskNotificationsReceived[0];
    const riskForNotification = latestNotification
      ? guardee.risks.find(
          (risk) => risk.riskType === latestNotification.riskType,
        )
      : undefined;

    if (
      latestNotification?.trigger ===
        GuardianRiskNotificationTrigger.FALL_DETECTED ||
      latestNotification?.trigger ===
        GuardianRiskNotificationTrigger.NEGATIVE_RESPONSE
    ) {
      return {
        safetyStatus: 'NEEDS_HELP' as const,
        riskType: latestNotification.riskType,
        riskLevel: riskForNotification?.riskLevel ?? null,
        trigger: latestNotification.trigger,
        updatedAt: latestNotification.sentAt,
      };
    }

    if (
      latestNotification?.trigger ===
      GuardianRiskNotificationTrigger.LIVENESS_TIMEOUT
    ) {
      return {
        safetyStatus: 'CHECK_IN_OVERDUE' as const,
        riskType: latestNotification.riskType,
        riskLevel: riskForNotification?.riskLevel ?? null,
        trigger: latestNotification.trigger,
        updatedAt: latestNotification.sentAt,
      };
    }

    const highestRisk = [...guardee.risks]
      .filter(
        (risk) =>
          risk.riskLevel === RiskLevel.HIGH ||
          risk.riskLevel === RiskLevel.CRITICAL,
      )
      .sort(
        (left, right) =>
          this.riskPriority(right.riskLevel) -
            this.riskPriority(left.riskLevel) ||
          right.updatedAt.getTime() - left.updatedAt.getTime(),
      )[0];
    if (highestRisk) {
      return {
        safetyStatus: 'AT_RISK' as const,
        riskType: highestRisk.riskType,
        riskLevel: highestRisk.riskLevel,
        trigger: null,
        updatedAt: highestRisk.updatedAt,
      };
    }

    const activeLivenessRisk = [...guardee.risks]
      .filter(
        (risk) =>
          risk.livenessCheckActivationMode !== LivenessCheckActivationMode.OFF,
      )
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )[0];
    if (activeLivenessRisk) {
      return {
        safetyStatus: 'PROTECTED' as const,
        riskType: activeLivenessRisk.riskType,
        riskLevel: activeLivenessRisk.riskLevel,
        trigger: null,
        updatedAt: activeLivenessRisk.updatedAt,
      };
    }

    return {
      safetyStatus: 'OK' as const,
      riskType: null,
      riskLevel: null,
      trigger: null,
      updatedAt: null,
    };
  }

  private riskPriority(riskLevel: RiskLevel): number {
    return riskLevel === RiskLevel.CRITICAL ? 2 : 1;
  }

  async removeGuardee(guardianId: string, guardeeId: string): Promise<void> {
    const result = await this.prisma.guardianRelationship.deleteMany({
      where: {
        guardianId,
        guardeeId,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Guardian relationship not found');
    }
  }
}
