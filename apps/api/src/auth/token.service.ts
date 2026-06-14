import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createId } from '../common/cuid';
import { PrismaService } from '../prisma/prisma.service';

// @nestjs/jwt types expiresIn as a `ms` StringValue union; config values are plain strings.
type ExpiresIn = JwtSignOptions['expiresIn'];
const ttl = (value: string): ExpiresIn => value as unknown as ExpiresIn;

interface AccessPayload {
  sub: string;
  email: string;
}

interface RefreshPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async signAccessToken(userId: string, email: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, email } satisfies AccessPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ttl(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
      },
    );
  }

  /** Issues a refresh token and stores its hash (keyed by jti) for revocation. */
  async issueRefreshToken(userId: string): Promise<string> {
    const jti = createId();
    const token = await this.jwt.signAsync(
      { sub: userId, jti } satisfies RefreshPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: ttl(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d'),
      },
    );
    const tokenHash = await argon2.hash(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { id: jti, userId, tokenHash, expiresAt },
    });
    return token;
  }

  /** Verifies a refresh token, confirms it is the live (unrotated, unrevoked) one. */
  async verifyRefreshToken(token: string): Promise<{ userId: string; jti: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }
    const matches = await argon2.verify(record.tokenHash, token);
    if (!matches) {
      throw new UnauthorizedException('Refresh token mismatch');
    }
    return { userId: payload.sub, jti: payload.jti };
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id: jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
