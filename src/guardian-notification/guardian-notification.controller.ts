import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListGuardianNotificationsDto } from './dto/list-guardian-notifications.dto';
import { GuardianNotificationService } from './guardian-notification.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('guardian-notifications')
@UseGuards(JwtAuthGuard)
export class GuardianNotificationController {
  constructor(private readonly notifications: GuardianNotificationService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListGuardianNotificationsDto,
  ) {
    return this.notifications.listForGuardian(
      request.user.sub,
      query.cursor,
      query.limit,
    );
  }
}
