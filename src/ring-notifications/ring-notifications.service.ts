import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RingNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordForRing(
    riskEventId: string,
    senderId: string,
    ringNumber: number,
  ): Promise<number> {
    if (ringNumber < 1) {
      throw new BadRequestException('Ring number must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const riskEvent = await tx.userRiskEvent.findUnique({
        where: { id: riskEventId },
        select: { userId: true },
      });
      if (!riskEvent) {
        throw new NotFoundException('Risk event not found');
      }
      if (riskEvent.userId !== senderId) {
        throw new BadRequestException('Risk event does not belong to sender');
      }

      const ring = await tx.userRing.findUnique({
        where: { ownerId_ringNumber: { ownerId: senderId, ringNumber } },
        select: { members: { select: { memberId: true } } },
      });
      if (!ring) {
        throw new NotFoundException('Ring not found');
      }
      if (ring.members.length === 0) {
        return 0;
      }

      const result = await tx.userRingNotification.createMany({
        data: ring.members.map(({ memberId }) => ({
          riskEventId,
          ringNumber,
          senderId,
          receiverId: memberId,
        })),
      });
      return result.count;
    });
  }
}
