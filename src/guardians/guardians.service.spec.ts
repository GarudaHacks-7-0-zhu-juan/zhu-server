import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  GuardianRelationshipInitiatorRole,
  GuardianRelationshipStatus,
  GuardianRiskNotificationTrigger,
  LivenessCheckActivationMode,
  RiskLevel,
  RiskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuardiansService } from './guardians.service';

describe('GuardiansService', () => {
  const guardeeId = 'guardee-1';
  const guardianId = 'guardian-1';
  const prisma = {
    user: { findUnique: jest.fn() },
    guardianRelationship: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new GuardiansService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a pending guardian request from a phone lookup', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: guardianId });
    prisma.guardianRelationship.findUnique.mockResolvedValue(null);
    prisma.guardianRelationship.upsert.mockResolvedValue({
      status: GuardianRelationshipStatus.PENDING,
    });

    await service.requestGuardian(guardeeId, '+628123456789');

    expect(prisma.guardianRelationship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guardianId_guardeeId: { guardianId, guardeeId } },
        create: {
          guardianId,
          guardeeId,
          initiatorRole: GuardianRelationshipInitiatorRole.GUARDEE,
        },
      }),
    );
  });

  it('creates a pending guardee request from a phone lookup', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: guardeeId });
    prisma.guardianRelationship.findUnique.mockResolvedValue(null);
    prisma.guardianRelationship.upsert.mockResolvedValue({
      status: GuardianRelationshipStatus.PENDING,
    });

    await service.requestGuardee(guardianId, '+628123456789');

    expect(prisma.guardianRelationship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guardianId_guardeeId: { guardianId, guardeeId } },
        create: {
          guardianId,
          guardeeId,
          initiatorRole: GuardianRelationshipInitiatorRole.GUARDIAN,
        },
      }),
    );
  });

  it('rejects a self-guardian request', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: guardeeId });

    await expect(
      service.requestGuardian(guardeeId, '+628123456789'),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not reset an accepted guardian relationship', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: guardianId });
    prisma.guardianRelationship.findUnique.mockResolvedValue({
      status: GuardianRelationshipStatus.ACCEPTED,
    });

    await expect(
      service.requestGuardian(guardeeId, '+628123456789'),
    ).rejects.toThrow(ConflictException);
  });

  it('resets a declined relationship with a new initiator and timestamps', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: guardeeId });
    prisma.guardianRelationship.findUnique.mockResolvedValue({
      status: GuardianRelationshipStatus.DECLINED,
    });
    prisma.guardianRelationship.upsert.mockResolvedValue({
      status: GuardianRelationshipStatus.PENDING,
    });

    await service.requestGuardee(guardianId, '+628123456789');

    expect(prisma.guardianRelationship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: GuardianRelationshipStatus.PENDING,
          initiatorRole: GuardianRelationshipInitiatorRole.GUARDIAN,
          respondedAt: null,
          requestedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('lists only accepted guardians and guardees', async () => {
    prisma.guardianRelationship.findMany.mockResolvedValue([]);

    await service.listGuardians(guardeeId);
    await service.listGuardees(guardianId);

    expect(prisma.guardianRelationship.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          guardeeId,
          status: GuardianRelationshipStatus.ACCEPTED,
        },
      }),
    );
    expect(prisma.guardianRelationship.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          guardianId,
          status: GuardianRelationshipStatus.ACCEPTED,
        },
        include: {
          guardee: {
            select: expect.objectContaining({
              location: true,
              risks: expect.any(Object),
              guardianRiskNotificationsReceived: expect.objectContaining({
                where: { guardianId },
                orderBy: { sentAt: 'desc' },
                take: 1,
              }),
            }),
          },
        },
      }),
    );
  });

  it('returns the latest guardian alert as a needs-help safety status', async () => {
    const sentAt = new Date('2026-07-17T10:00:00.000Z');
    prisma.guardianRelationship.findMany.mockResolvedValue([
      {
        id: 'relationship-1',
        guardee: {
          id: guardeeId,
          email: 'guardee@example.com',
          phoneNumber: '+628123456789',
          location: { latitude: 1, longitude: 2, updatedAt: sentAt },
          risks: [
            {
              riskType: RiskType.ACCIDENT,
              riskLevel: RiskLevel.HIGH,
              updatedAt: sentAt,
              livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
            },
          ],
          guardianRiskNotificationsReceived: [
            {
              riskType: RiskType.ACCIDENT,
              trigger: GuardianRiskNotificationTrigger.FALL_DETECTED,
              sentAt,
            },
          ],
        },
      },
    ]);

    await expect(service.listGuardees(guardianId)).resolves.toEqual([
      expect.objectContaining({
        location: { latitude: 1, longitude: 2, updatedAt: sentAt },
        safetyStatus: 'NEEDS_HELP',
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.HIGH,
        trigger: GuardianRiskNotificationTrigger.FALL_DETECTED,
        updatedAt: sentAt,
      }),
    ]);
    const [guardee] = await service.listGuardees(guardianId);
    expect(guardee.guardee).not.toHaveProperty('risks');
    expect(guardee.guardee).not.toHaveProperty(
      'guardianRiskNotificationsReceived',
    );
  });

  it('lists pending and declined requests for each role', async () => {
    await service.listGuardianRequests(guardeeId);
    await service.listGuardeeRequests(guardianId);

    expect(prisma.guardianRelationship.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          guardeeId,
          status: expect.objectContaining({
            in: [
              GuardianRelationshipStatus.PENDING,
              GuardianRelationshipStatus.DECLINED,
            ],
          }),
        }),
        include: { guardian: { select: expect.any(Object) } },
      }),
    );
    expect(prisma.guardianRelationship.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ guardianId }),
        include: { guardee: { select: expect.any(Object) } },
      }),
    );
  });

  it('requires an accepted relationship for guardee details', async () => {
    prisma.guardianRelationship.findFirst.mockResolvedValue(null);

    await expect(
      service.getGuardeeDetail(guardianId, guardeeId),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns current risk data as an at-risk guardee detail', async () => {
    const updatedAt = new Date('2026-07-17T11:00:00.000Z');
    prisma.guardianRelationship.findFirst.mockResolvedValue({
      guardee: {
        id: guardeeId,
        email: 'guardee@example.com',
        phoneNumber: '+628123456789',
        location: null,
        risks: [
          {
            riskType: RiskType.DISASTER,
            riskLevel: RiskLevel.CRITICAL,
            updatedAt,
            livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
          },
        ],
        guardianRiskNotificationsReceived: [],
      },
    });

    await expect(
      service.getGuardeeDetail(guardianId, guardeeId),
    ).resolves.toEqual(
      expect.objectContaining({
        location: null,
        safetyStatus: 'AT_RISK',
        riskType: RiskType.DISASTER,
        riskLevel: RiskLevel.CRITICAL,
        trigger: null,
        updatedAt,
      }),
    );
    expect(prisma.guardianRelationship.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          guardee: {
            select: expect.objectContaining({
              location: true,
              risks: expect.any(Object),
              guardianRiskNotificationsReceived: expect.objectContaining({
                where: { guardianId },
                orderBy: { sentAt: 'desc' },
                take: 1,
              }),
            }),
          },
        },
      }),
    );
  });

  it('accepts a pending guardian request', async () => {
    prisma.guardianRelationship.findUnique.mockResolvedValue({
      status: GuardianRelationshipStatus.PENDING,
      initiatorRole: GuardianRelationshipInitiatorRole.GUARDEE,
    });
    prisma.guardianRelationship.update.mockResolvedValue({
      status: GuardianRelationshipStatus.ACCEPTED,
    });

    await service.respondToRequest(
      guardianId,
      guardeeId,
      GuardianRelationshipStatus.ACCEPTED,
    );

    expect(prisma.guardianRelationship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GuardianRelationshipStatus.ACCEPTED,
        }),
      }),
    );
  });

  it('rejects a response from the request initiator', async () => {
    prisma.guardianRelationship.findUnique.mockResolvedValue({
      status: GuardianRelationshipStatus.PENDING,
      initiatorRole: GuardianRelationshipInitiatorRole.GUARDEE,
    });

    await expect(
      service.respondToGuardianRequest(
        guardeeId,
        guardianId,
        GuardianRelationshipStatus.ACCEPTED,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a resolved request response', async () => {
    prisma.guardianRelationship.findUnique.mockResolvedValue({
      status: GuardianRelationshipStatus.DECLINED,
      initiatorRole: GuardianRelationshipInitiatorRole.GUARDEE,
    });

    await expect(
      service.respondToRequest(
        guardianId,
        guardeeId,
        GuardianRelationshipStatus.ACCEPTED,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('removes a guardee relationship regardless of its status', async () => {
    prisma.guardianRelationship.deleteMany.mockResolvedValue({ count: 1 });

    await service.removeGuardee(guardianId, guardeeId);

    expect(prisma.guardianRelationship.deleteMany).toHaveBeenCalledWith({
      where: { guardianId, guardeeId },
    });
  });

  it('removes a guardian relationship regardless of its status', async () => {
    prisma.guardianRelationship.deleteMany.mockResolvedValue({ count: 1 });

    await service.removeGuardian(guardeeId, guardianId);

    expect(prisma.guardianRelationship.deleteMany).toHaveBeenCalledWith({
      where: { guardianId, guardeeId },
    });
  });
});
