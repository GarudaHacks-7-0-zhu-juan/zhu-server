import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    email: string,
    passwordHash: string,
    phoneNumber: string,
    deviceId: string,
  ): Promise<User> {
    return this.prisma.user.create({
      data: { email, passwordHash, phoneNumber, deviceId },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updateRefreshToken(
    id: string,
    refreshTokenHash: string | null,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { refreshTokenHash },
    });
  }
}
