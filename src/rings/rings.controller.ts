import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ReplaceRingMembersDto } from './dto/replace-ring-members.dto';
import { RingsService } from './rings.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('users/rings')
@UseGuards(JwtAuthGuard)
export class RingsController {
  constructor(private readonly rings: RingsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.rings.list(request.user.sub);
  }

  @Put(':ringNumber')
  replaceMembers(
    @Req() request: AuthenticatedRequest,
    @Param('ringNumber', ParseIntPipe) ringNumber: number,
    @Body() dto: ReplaceRingMembersDto,
  ) {
    return this.rings.replaceMembers(
      request.user.sub,
      ringNumber,
      dto.memberIds,
    );
  }

  @Delete(':ringNumber')
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('ringNumber', ParseIntPipe) ringNumber: number,
  ): Promise<void> {
    await this.rings.remove(request.user.sub, ringNumber);
  }
}
