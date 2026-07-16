import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { GuardianRelationshipStatus } from '@prisma/client';
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
        create: { guardianId, guardeeId },
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

  it('requires an accepted relationship for guardee details', async () => {
    prisma.guardianRelationship.findFirst.mockResolvedValue(null);

    await expect(
      service.getGuardeeDetail(guardianId, guardeeId),
    ).rejects.toThrow(NotFoundException);
  });

  it('accepts a pending guardian request', async () => {
    prisma.guardianRelationship.findUnique.mockResolvedValue({
      status: GuardianRelationshipStatus.PENDING,
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
});
