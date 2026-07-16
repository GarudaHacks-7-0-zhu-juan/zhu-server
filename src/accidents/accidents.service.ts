import { Injectable } from '@nestjs/common';
import { AccidentEventType, UserAccidentEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccidentEventInput } from './accidents.types';

@Injectable()
export class AccidentsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.recordEvent({
      userId,
      eventType: AccidentEventType.FALL_DETECTED,
      detectedAt,
    });
  }
}
