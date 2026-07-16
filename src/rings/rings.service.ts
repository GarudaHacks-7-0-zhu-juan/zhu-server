import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerId: string) {
    return this.prisma.userRing.findMany({
      where: { ownerId },
      orderBy: { ringNumber: 'asc' },
      include: {
        members: {
          orderBy: { createdAt: 'asc' },
          include: {
            member: {
              select: { id: true, email: true, phoneNumber: true },
            },
          },
        },
      },
    });
  }

  async replaceMembers(
    ownerId: string,
    ringNumber: number,
    memberIds: string[],
  ) {
    if (ringNumber < 1) {
      throw new BadRequestException('Ring number must be positive');
    }
    if (memberIds.includes(ownerId)) {
      throw new BadRequestException(
        'A user cannot be a member of their own ring',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const members = await tx.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true },
      });
      if (members.length !== memberIds.length) {
        throw new NotFoundException('One or more ring members do not exist');
      }

      const ring = await tx.userRing.upsert({
        where: { ownerId_ringNumber: { ownerId, ringNumber } },
        create: { ownerId, ringNumber },
        update: {},
      });

      await tx.userRingMember.deleteMany({
        where: { ownerId, ringId: ring.id },
      });
      if (memberIds.length > 0) {
        await tx.userRingMember.deleteMany({
          where: { ownerId, memberId: { in: memberIds } },
        });
        await tx.userRingMember.createMany({
          data: memberIds.map((memberId) => ({
            ownerId,
            memberId,
            ringId: ring.id,
          })),
        });
      }

      return tx.userRing.findUniqueOrThrow({
        where: { ownerId_ringNumber: { ownerId, ringNumber } },
        include: {
          members: {
            orderBy: { createdAt: 'asc' },
            include: {
              member: {
                select: { id: true, email: true, phoneNumber: true },
              },
            },
          },
        },
      });
    });
  }

  async remove(ownerId: string, ringNumber: number): Promise<void> {
    if (ringNumber < 1) {
      throw new BadRequestException('Ring number must be positive');
    }

    const result = await this.prisma.userRing.deleteMany({
      where: { ownerId, ringNumber },
    });
    if (result.count === 0) {
      throw new NotFoundException('Ring not found');
    }
  }
}
