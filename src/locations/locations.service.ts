import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const timestamp = new Date();

    const [location, event] = await this.prisma.$transaction([
      this.prisma.userLocation.upsert({
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
      }),
      this.prisma.userLocationEvent.create({
        data: {
          userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          detectedAt: timestamp,
        },
      }),
    ]);

    return { location, event };
  }
}
