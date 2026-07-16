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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const userSummary = {
  id: true,
  email: true,
  phoneNumber: true,
} as const;

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

  listGuardees(guardianId: string) {
    return this.prisma.guardianRelationship.findMany({
      where: { guardianId, status: GuardianRelationshipStatus.ACCEPTED },
      orderBy: { updatedAt: 'desc' },
      include: { guardee: { select: userSummary } },
    });
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
          select: {
            ...userSummary,
            location: true,
          },
        },
      },
    });
    if (!relationship) {
      throw new NotFoundException('Accepted guardian relationship not found');
    }

    return {
      guardee: relationship.guardee,
      location: relationship.guardee.location,
    };
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
