import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuardianRelationshipStatus } from '@prisma/client';
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

    const existing = await this.prisma.guardianRelationship.findUnique({
      where: { guardianId_guardeeId: { guardianId: guardian.id, guardeeId } },
    });
    if (existing?.status === GuardianRelationshipStatus.ACCEPTED) {
      throw new ConflictException('Guardian relationship already exists');
    }

    const now = new Date();
    return this.prisma.guardianRelationship.upsert({
      where: { guardianId_guardeeId: { guardianId: guardian.id, guardeeId } },
      create: { guardianId: guardian.id, guardeeId },
      update: {
        status: GuardianRelationshipStatus.PENDING,
        requestedAt: now,
        respondedAt: null,
      },
      include: { guardian: { select: userSummary } },
    });
  }

  listGuardians(guardeeId: string) {
    return this.prisma.guardianRelationship.findMany({
      where: { guardeeId },
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

  listIncomingRequests(guardianId: string) {
    return this.prisma.guardianRelationship.findMany({
      where: { guardianId, status: GuardianRelationshipStatus.PENDING },
      orderBy: { requestedAt: 'asc' },
      include: { guardee: { select: userSummary } },
    });
  }

  async respondToRequest(
    guardianId: string,
    guardeeId: string,
    status: 'ACCEPTED' | 'DECLINED',
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

    return this.prisma.guardianRelationship.update({
      where: { guardianId_guardeeId: { guardianId, guardeeId } },
      data: { status, respondedAt: new Date() },
      include: { guardee: { select: userSummary } },
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
        status: GuardianRelationshipStatus.ACCEPTED,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Accepted guardian relationship not found');
    }
  }
}
