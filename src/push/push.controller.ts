import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { PushService } from './push.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('devices')
  registerDevice(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return this.push.registerDevice(request.user.sub, dto);
  }

  @Delete('devices/:registrationToken')
  removeDevice(
    @Req() request: AuthenticatedRequest,
    @Param('registrationToken') registrationToken: string,
  ) {
    return this.push.removeDevice(request.user.sub, registrationToken);
  }

  @Post('test')
  sendTestNotification(@Req() request: AuthenticatedRequest) {
    return this.push.sendTestNotification(request.user.sub);
  }

  @Post('test/liveness-check')
  sendTestLivenessCheck(@Req() request: AuthenticatedRequest) {
    return this.push.sendTestLivenessCheck(request.user.sub);
  }
}
