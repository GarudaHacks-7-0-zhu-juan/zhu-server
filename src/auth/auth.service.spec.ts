import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RequestContextService } from '../logging/request-context.service';
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
  const requestContext = { requestId: 'request-1' };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
    requestContext as RequestContextService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists email and phone identifiers on registration', async () => {
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
      displayName: 'Ada',
    });

    expect(users.create).toHaveBeenCalledWith(
      'user@example.com',
      'password-hash',
      '+628123456789',
      'Ada',
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith({
      event: 'auth.registered',
      requestId: 'request-1',
      userId: 'user-1',
    });
  });

  it('verifies the password when logging in', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'password-hash',
    });
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    jwt.signAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');

    await service.login({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'password-hash');
    expect(Logger.prototype.log).toHaveBeenCalledWith({
      event: 'auth.login.succeeded',
      requestId: 'request-1',
      userId: 'user-1',
    });
  });
});
