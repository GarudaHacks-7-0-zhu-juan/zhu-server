import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('selects only public fields for a profile', async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const service = new UsersService(prisma as unknown as PrismaService);
    prisma.user.findUnique.mockResolvedValue(null);

    await service.findProfileById('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
});
