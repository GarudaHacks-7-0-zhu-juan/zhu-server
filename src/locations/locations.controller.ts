import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  updateLocation(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locations.updateLocation(request.user.sub, dto);
  }
}
