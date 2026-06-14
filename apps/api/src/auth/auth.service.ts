import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthUser, SigninInput, SignupInput } from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function toAuthUser(u: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
}): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    timezone: u.timezone,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(input.password);

    // Create the user and their personal workspace atomically.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await tx.workspace.create({
        data: {
          name: 'My Workspace',
          ownerId: created.id,
          members: { create: { userId: created.id, role: 'OWNER' } },
        },
      });
      return created;
    });

    return this.issueFor(user);
  }

  async signin(input: SigninInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueFor(user);
  }

  /** Rotates the refresh token: revokes the presented one, issues a fresh pair. */
  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const { userId, jti } = await this.tokens.verifyRefreshToken(rawToken);
    await this.tokens.revokeRefreshToken(jti);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.issueFor(user);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const { jti } = await this.tokens.verifyRefreshToken(rawToken);
      await this.tokens.revokeRefreshToken(jti);
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  private async issueFor(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    timezone: string;
  }): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken(user.id, user.email),
      this.tokens.issueRefreshToken(user.id),
    ]);
    return { accessToken, refreshToken, user: toAuthUser(user) };
  }
}
