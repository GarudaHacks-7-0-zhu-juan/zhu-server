import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async getProfile(@Req() request: AuthenticatedRequest) {
    const profile = await this.users.findProfileById(request.user.sub);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return profile;
  }
}
