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
import { SetLivenessCheckDto } from './dto/set-liveness-check.dto';
import { UserRisksService } from './user-risks.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('user-risks')
@UseGuards(JwtAuthGuard)
export class UserRisksController {
  constructor(private readonly userRisks: UserRisksService) {}

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
  respondToLivenessCheck(
    @Req() request: AuthenticatedRequest,
    @Param('riskType', new ParseEnumPipe(RiskType)) riskType: RiskType,
  ) {
    return this.userRisks.respondToLivenessCheck(request.user.sub, riskType);
  }
}
