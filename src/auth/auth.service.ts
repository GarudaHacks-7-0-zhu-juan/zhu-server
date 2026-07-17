import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RequestContextService } from '../logging/request-context.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  async register({ email, password, phoneNumber, displayName }: RegisterDto) {
    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      this.logger.warn({
        event: 'auth.registration.rejected',
        requestId: this.requestContext.requestId,
      });
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      user = await this.users.create(
        email,
        passwordHash,
        phoneNumber,
        displayName,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn({
          event: 'auth.registration.rejected',
          requestId: this.requestContext.requestId,
        });
        throw new ConflictException(
          'Email or phone number is already registered',
        );
      }
      throw error;
    }
    const tokens = await this.issueTokens(user.id, user.email);
    this.logger.log({
      event: 'auth.registered',
      requestId: this.requestContext.requestId,
      userId: user.id,
    });
    return tokens;
  }

  async login({ email, password }: LoginDto) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      this.logger.warn({
        event: 'auth.login.rejected',
        requestId: this.requestContext.requestId,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    this.logger.log({
      event: 'auth.login.succeeded',
      requestId: this.requestContext.requestId,
      userId: user.id,
    });
    return tokens;
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.logger.warn({
        event: 'auth.refresh.rejected',
        requestId: this.requestContext.requestId,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findById(payload.sub);
    if (
      !user ||
      !user.refreshTokenHash ||
      !(await bcrypt.compare(refreshToken, user.refreshTokenHash))
    ) {
      this.logger.warn({
        event: 'auth.refresh.rejected',
        requestId: this.requestContext.requestId,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: string): Promise<void> {
    await this.users.updateRefreshToken(userId, null);
    this.logger.log({
      event: 'auth.logged_out',
      requestId: this.requestContext.requestId,
      userId,
    });
  }

  private async issueTokens(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    await this.users.updateRefreshToken(
      userId,
      await bcrypt.hash(refreshToken, 12),
    );
    return { accessToken, refreshToken };
  }
}
