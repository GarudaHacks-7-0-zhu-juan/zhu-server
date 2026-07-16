import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { RiskType, UserRisk } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { SetLivenessCheckDto } from './dto/set-liveness-check.dto';
import { UserRisksController } from './user-risks.controller';
import { UserRisksService } from './user-risks.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

describe('UserRisksController', () => {
  let controller: UserRisksController;
  let service: UserRisksService;

  const mockRisk = {
    userId: 'user-1',
    riskType: RiskType.HIGH_RISK_AREA,
    livenessCheckEnabled: false,
  } as UserRisk;

  const mockUserRisksService = {
    setLivenessCheckEnabled: jest.fn().mockResolvedValue(mockRisk),
    getLivenessCheckStatuses: jest
      .fn()
      .mockResolvedValue([
        { riskType: RiskType.HIGH_RISK_AREA, livenessCheckEnabled: true },
      ]),
    respondToLivenessCheck: jest.fn().mockResolvedValue({
      risk: mockRisk,
      event: { id: 'risk-event-1' },
    }),
  };

  const request = {
    user: { sub: 'user-1', email: 'test@example.com' },
  } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserRisksController],
      providers: [
        { provide: UserRisksService, useValue: mockUserRisksService },
      ],
    }).compile();

    controller = module.get<UserRisksController>(UserRisksController);
    service = module.get<UserRisksService>(UserRisksService);

    jest.clearAllMocks();
  });

  describe('setLivenessCheck', () => {
    it('sets the liveness toggle for the authenticated user', async () => {
      const dto: SetLivenessCheckDto = { enabled: false };
      const setSpy = jest.spyOn(service, 'setLivenessCheckEnabled');

      const result = await controller.setLivenessCheck(
        request,
        RiskType.HIGH_RISK_AREA,
        dto,
      );

      expect(setSpy).toHaveBeenCalledWith(
        'user-1',
        RiskType.HIGH_RISK_AREA,
        false,
      );
      expect(result).toBe(mockRisk);
    });
  });

  describe('getLivenessCheckStatuses', () => {
    it('returns toggle statuses for the authenticated user', async () => {
      const getSpy = jest.spyOn(service, 'getLivenessCheckStatuses');

      const result = await controller.getLivenessCheckStatuses(request);

      expect(getSpy).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([
        { riskType: RiskType.HIGH_RISK_AREA, livenessCheckEnabled: true },
      ]);
    });
  });

  describe('respondToLivenessCheck', () => {
    it('resets the risk level for the authenticated user', async () => {
      const respondSpy = jest.spyOn(service, 'respondToLivenessCheck');

      const result = await controller.respondToLivenessCheck(
        request,
        RiskType.HIGH_RISK_AREA,
      );

      expect(respondSpy).toHaveBeenCalledWith(
        'user-1',
        RiskType.HIGH_RISK_AREA,
      );
      expect(result).toEqual({
        risk: mockRisk,
        event: { id: 'risk-event-1' },
      });
    });
  });
});
