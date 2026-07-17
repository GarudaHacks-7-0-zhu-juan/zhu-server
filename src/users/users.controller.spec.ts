import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const users = { findProfileById: jest.fn() };
  const controller = new UsersController(users as unknown as UsersService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the authenticated user profile', async () => {
    const profile = {
      id: 'user-1',
      displayName: 'Test User',
      email: 'user@example.com',
      phoneNumber: '+628123456789',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.findProfileById.mockResolvedValue(profile);

    await expect(
      controller.getProfile({ user: { sub: 'user-1' } } as never),
    ).resolves.toEqual(profile);
    expect(users.findProfileById).toHaveBeenCalledWith('user-1');
  });

  it('returns not found when the JWT user no longer exists', async () => {
    users.findProfileById.mockResolvedValue(null);

    await expect(
      controller.getProfile({ user: { sub: 'deleted-user' } } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
