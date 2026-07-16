import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RingNotificationsService } from './ring-notifications.service';

describe('RingNotificationsService', () => {
  const senderId = '5eb2e22f-4814-4fa5-907a-ef99860c94bb';
  const receiverId = 'fa4921a9-5df5-438e-b2cb-759895b9b9c5';
  const tx = {
    userRiskEvent: { findUnique: jest.fn() },
    userRing: { findUnique: jest.fn() },
    userRingNotification: { createMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new RingNotificationsService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
  });

  it('rejects a risk event owned by a different sender', async () => {
    tx.userRiskEvent.findUnique.mockResolvedValue({ userId: receiverId });

    await expect(service.recordForRing('risk-1', senderId, 1)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing ring', async () => {
    tx.userRiskEvent.findUnique.mockResolvedValue({ userId: senderId });
    tx.userRing.findUnique.mockResolvedValue(null);

    await expect(service.recordForRing('risk-1', senderId, 1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('records one notification per current ring member', async () => {
    tx.userRiskEvent.findUnique.mockResolvedValue({ userId: senderId });
    tx.userRing.findUnique.mockResolvedValue({
      members: [{ memberId: receiverId }],
    });
    tx.userRingNotification.createMany.mockResolvedValue({ count: 1 });

    await expect(service.recordForRing('risk-1', senderId, 1)).resolves.toBe(1);

    expect(tx.userRingNotification.createMany).toHaveBeenCalledWith({
      data: [
        {
          riskEventId: 'risk-1',
          ringNumber: 1,
          senderId,
          receiverId,
        },
      ],
    });
  });
});
