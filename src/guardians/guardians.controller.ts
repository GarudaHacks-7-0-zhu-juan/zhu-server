import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateGuardianRequestDto } from './dto/create-guardian-request.dto';
import { RespondGuardianRequestDto } from './dto/respond-guardian-request.dto';
import { GuardiansService } from './guardians.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('guardians')
@UseGuards(JwtAuthGuard)
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  @Post('requests')
  request(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateGuardianRequestDto,
  ) {
    return this.guardians.requestGuardian(request.user.sub, dto.phoneNumber);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.guardians.listGuardians(request.user.sub);
  }

  @Delete(':guardianId')
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('guardianId') guardianId: string,
  ): Promise<void> {
    await this.guardians.removeGuardian(request.user.sub, guardianId);
  }
}

@Controller('guardees')
@UseGuards(JwtAuthGuard)
export class GuardeesController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get('requests')
  listRequests(@Req() request: AuthenticatedRequest) {
    return this.guardians.listIncomingRequests(request.user.sub);
  }

  @Patch('requests/:guardeeId')
  respond(
    @Req() request: AuthenticatedRequest,
    @Param('guardeeId') guardeeId: string,
    @Body() dto: RespondGuardianRequestDto,
  ) {
    return this.guardians.respondToRequest(
      request.user.sub,
      guardeeId,
      dto.status,
    );
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.guardians.listGuardees(request.user.sub);
  }

  @Get(':guardeeId')
  detail(
    @Req() request: AuthenticatedRequest,
    @Param('guardeeId') guardeeId: string,
  ) {
    return this.guardians.getGuardeeDetail(request.user.sub, guardeeId);
  }

  @Delete(':guardeeId')
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('guardeeId') guardeeId: string,
  ): Promise<void> {
    await this.guardians.removeGuardee(request.user.sub, guardeeId);
  }
}
