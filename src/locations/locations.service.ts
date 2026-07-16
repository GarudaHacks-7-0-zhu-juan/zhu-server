import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const timestamp = new Date();

    return this.prisma.$transaction(async (tx) => {
      const location = await tx.userLocation.upsert({
        where: { userId },
        create: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          updatedAt: timestamp,
        },
        update: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          updatedAt: timestamp,
        },
      });

      const event = await tx.userLocationEvent.create({
        data: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          detectedAt: timestamp,
        },
      });

      const lastSequence = await tx.userEventOutbox.aggregate({
        where: { userId },
        _max: { sequence: true },
      });

      const sequence = (lastSequence._max.sequence ?? 0) + 1;

      await tx.userEventOutbox.create({
        data: {
          userId,
          sequence,
          eventType: 'user.location.updated',
          payload: {
            latitude: dto.latitude,
            longitude: dto.longitude,
            detectedAt: timestamp.toISOString(),
            locationEventId: event.id,
          },
        },
      });

      return { location, event };
    });
  }
}
