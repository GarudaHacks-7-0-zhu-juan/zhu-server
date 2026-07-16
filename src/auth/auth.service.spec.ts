import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  const users = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateRefreshToken: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };
  const config = { getOrThrow: jest.fn() };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists device and phone identifiers on registration', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    jest.mocked(bcrypt.hash).mockResolvedValue('password-hash' as never);
    jwt.signAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');

    await service.register({
      email: 'user@example.com',
      password: 'password123',
      phoneNumber: '+628123456789',
      deviceId: 'device-1',
    });

    expect(users.create).toHaveBeenCalledWith(
      'user@example.com',
      'password-hash',
      '+628123456789',
      'device-1',
    );
  });

  it('denies login when the device differs before checking the password', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      deviceId: 'registered-device',
      passwordHash: 'password-hash',
    });

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'password123',
        deviceId: 'other-device',
      }),
    ).rejects.toThrow('Invalid email or password');

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
});
