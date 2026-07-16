import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RingsService } from './rings.service';

describe('RingsService', () => {
  const ownerId = 'f376bb8d-3f88-4305-b2d4-70e1531ed130';
  const memberId = '03ddc6ef-e9d2-4940-b31f-7a532e15364c';
  const ring = { id: 'ring-1', ownerId, ringNumber: 1 };
  const tx = {
    user: { findMany: jest.fn() },
    userRing: { upsert: jest.fn(), findUniqueOrThrow: jest.fn() },
    userRingMember: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    userRing: { findMany: jest.fn(), deleteMany: jest.fn() },
  };
  const service = new RingsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
  });

  it('rejects a non-positive ring number', async () => {
    await expect(service.replaceMembers(ownerId, 0, [])).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects self-membership', async () => {
    await expect(service.replaceMembers(ownerId, 1, [ownerId])).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replaces a ring and moves supplied members from other rings', async () => {
    tx.user.findMany.mockResolvedValue([{ id: memberId }]);
    tx.userRing.upsert.mockResolvedValue(ring);
    tx.userRing.findUniqueOrThrow.mockResolvedValue({ ...ring, members: [] });

    await service.replaceMembers(ownerId, 1, [memberId]);

    expect(tx.userRingMember.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { ownerId, ringId: ring.id },
    });
    expect(tx.userRingMember.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { ownerId, memberId: { in: [memberId] } },
    });
    expect(tx.userRingMember.createMany).toHaveBeenCalledWith({
      data: [{ ownerId, memberId, ringId: ring.id }],
    });
  });

  it('rejects an unknown ring member', async () => {
    tx.user.findMany.mockResolvedValue([]);

    await expect(
      service.replaceMembers(ownerId, 1, [memberId]),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns not found when deleting an unknown ring', async () => {
    prisma.userRing.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(ownerId, 1)).rejects.toThrow(NotFoundException);
  });
});
