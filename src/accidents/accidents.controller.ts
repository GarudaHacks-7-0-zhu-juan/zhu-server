import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AccidentsService } from './accidents.service';
import { CreateAccidentEventDto } from './dto/create-accident-event.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('accidents')
@UseGuards(JwtAuthGuard)
export class AccidentsController {
  constructor(private readonly accidents: AccidentsService) {}

  @Post()
  async createEvent(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAccidentEventDto,
  ) {
    const detectedAt = dto.detectedAt ? new Date(dto.detectedAt) : new Date();

    return this.accidents.recordEvent({
      userId: request.user.sub,
      eventType: dto.eventType,
      detectedAt,
    });
  }
}
