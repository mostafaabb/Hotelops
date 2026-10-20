import { randomBytes } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { RefreshTokenPayload, TokenService } from './token.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { AuditService } from '../modules/audit/audit.service';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active. Contact your administrator.');
    }

    const valid = await this.passwordService.verify(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = await this.createSession(user.id, ip, userAgent);
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.record(user.id, user.organizationId, 'LOGIN', 'User', user.id, {
      ip,
    });

    return {
      accessToken,
      refreshToken: session.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: { refreshToken: dto.refreshToken },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    const newSession = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: this.generateRefreshTokenValue(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
    });

    return {
      accessToken,
      refreshToken: newSession.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: { userId, refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.auditService.record(userId, user.organizationId, 'LOGOUT', 'User', userId);
    }
    return { success: true };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        hotelId: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
        hotel: {
          select: { id: true, name: true, currency: true, timezone: true },
        },
        organization: {
          select: { id: true, name: true, currency: true, timezone: true },
        },
        staffProfile: {
          select: { id: true, employeeId: true, position: true, departmentId: true },
        },
      },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto, orgId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: this.hashResetToken(token),
        expiresAt,
      },
    });

    await this.notificationsService.sendMail(
      user.email,
      'Reset your HotelOps password',
      `Use this link to reset your password: ${process.env.FRONTEND_URL}/reset-password?token=${token}`,
      'reset-password'
    );

    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashed = this.hashResetToken(dto.token);
    const reset = await this.prisma.passwordReset.findFirst({
      where: { token: hashed, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!reset) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been reset successfully.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Cannot change password');
    }

    const valid = await this.passwordService.verify(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed successfully.' };
  }

  private async createSession(userId: string, ip: string, userAgent: string) {
    const refreshToken = this.generateRefreshTokenValue();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return session;
  }

  private generateRefreshTokenValue(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashResetToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    role: string;
    hotelId: string | null;
    organizationId: string;
    status: string;
  }) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      hotelId: user.hotelId,
      organizationId: user.organizationId,
      status: user.status,
    };
  }
}