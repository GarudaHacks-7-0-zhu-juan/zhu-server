import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RiskType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { GuardianNotificationService } from '../guardian-notification/guardian-notification.service';
import { RespondToLivenessCheckDto } from './dto/respond-to-liveness-check.dto';
import { SetLivenessCheckDto } from './dto/set-liveness-check.dto';
import { UserRisksService } from './user-risks.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('user-risks')
@UseGuards(JwtAuthGuard)
export class UserRisksController {
  constructor(
    private readonly userRisks: UserRisksService,
    private readonly guardianNotifications: GuardianNotificationService,
  ) {}

  @Patch(':riskType/liveness-check')
  setLivenessCheck(
    @Req() request: AuthenticatedRequest,
    @Param('riskType', new ParseEnumPipe(RiskType)) riskType: RiskType,
    @Body() dto: SetLivenessCheckDto,
  ) {
    return this.userRisks.setLivenessCheckEnabled(
      request.user.sub,
      riskType,
      dto.enabled,
    );
  }

  @Get('liveness-check')
  getLivenessCheckStatuses(@Req() request: AuthenticatedRequest) {
    return this.userRisks.getLivenessCheckStatuses(request.user.sub);
  }

  @Post(':riskType/liveness-check/respond')
  async respondToLivenessCheck(
    @Req() request: AuthenticatedRequest,
    @Param('riskType', new ParseEnumPipe(RiskType)) riskType: RiskType,
    @Body() dto: RespondToLivenessCheckDto,
  ) {
    const result = await this.userRisks.respondToLivenessCheck(
      request.user.sub,
      riskType,
      dto.isOkay,
    );
    if (!dto.isOkay && riskType !== RiskType.ACCIDENT) {
      await this.guardianNotifications.enqueueNegativeResponse({
        guardeeId: request.user.sub,
        riskType,
        responseEventId: result.event.id,
      });
    }

    return result;
  }
}
