import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

describe('LocationsController', () => {
  let controller: LocationsController;
  let service: LocationsService;

  const mockLocation = {
    userId: 'user-1',
    latitude: 1.23,
    longitude: 4.56,
    updatedAt: new Date(),
  };

  const mockEvent = {
    id: 'event-1',
    userId: 'user-1',
    latitude: 1.23,
    longitude: 4.56,
    detectedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [LocationsService],
    })
      .overrideProvider(LocationsService)
      .useValue({
        updateLocation: jest
          .fn()
          .mockResolvedValue({ location: mockLocation, event: mockEvent }),
      })
      .compile();

    controller = module.get<LocationsController>(LocationsController);
    service = module.get<LocationsService>(LocationsService);
  });

  describe('updateLocation', () => {
    it('updates location using the authenticated user id', async () => {
      const dto: UpdateLocationDto = { latitude: 1.23, longitude: 4.56 };
      const request = {
        user: { sub: 'user-1', email: 'test@example.com' },
      } as unknown as AuthenticatedRequest;
      const updateLocationSpy = jest.spyOn(service, 'updateLocation');

      const result = await controller.updateLocation(request, dto);

      expect(updateLocationSpy).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ location: mockLocation, event: mockEvent });
    });
  });
});
