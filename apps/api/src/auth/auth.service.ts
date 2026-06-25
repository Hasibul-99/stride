import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  AuthUser,
  OtpPurpose,
  ResetPasswordInput,
  SigninInput,
  SignupInput,
  VerifyEmailInput,
} from '@teamboard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import type { OtpVerifyResult } from '../otp/otp.constants';
import { TokenService } from './token.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Generic response for OTP-issuing endpoints (no tokens, no enumeration). */
export interface OtpIssuedResult {
  message: string;
  email: string;
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
    private readonly otp: OtpService,
  ) {}

  /**
   * Create an UNVERIFIED account and email a verification code. No tokens are
   * returned — the user must verify the code (verifyEmail) before signing in.
   * Re-registering an unverified email re-issues a fresh code (respecting cooldown);
   * a verified email is rejected.
   */
  async signup(input: SignupInput): Promise<OtpIssuedResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (existing) {
      if (existing.emailVerifiedAt) {
        throw new ConflictException('Email already in use');
      }
      // Pending (unverified) account — refresh the password and re-send a code.
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, passwordHash: await argon2.hash(input.password) },
      });
      await this.otp.issue(input.email, 'registration');
      return { message: 'Verification code sent', email: input.email };
    }

    const passwordHash = await argon2.hash(input.password);
    // Create the user + their personal workspace atomically (unverified).
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash, emailVerifiedAt: null },
      });
      await tx.workspace.create({
        data: {
          name: 'My Workspace',
          ownerId: created.id,
          members: { create: { userId: created.id, role: 'OWNER' } },
        },
      });
    });

    await this.otp.issue(input.email, 'registration');
    return { message: 'Verification code sent', email: input.email };
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
    if (!user.emailVerifiedAt) {
      // Distinct 403 so the client can route to the verify screen + resend.
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', email: user.email });
    }
    return this.issueFor(user);
  }

  /** Verify a signup code → mark verified → issue tokens (user lands logged in). */
  async verifyEmail(input: VerifyEmailInput): Promise<AuthResult> {
    const result = await this.otp.verify(input.email, 'registration', input.code, { consume: true });
    this.assertOtpOk(result);

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      // Code consumed but no user — treat as a generic failure.
      throw new UnprocessableEntityException('Invalid or expired code');
    }
    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return this.issueFor(user);
  }

  /** Re-send a code. Always returns the same generic body (no enumeration). */
  async resendOtp(email: string, purpose: OtpPurpose): Promise<OtpIssuedResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (purpose === 'registration') {
      if (user && !user.emailVerifiedAt) await this.otp.issue(email, 'registration');
    } else if (user) {
      await this.otp.issue(email, 'password_reset');
    }
    return { message: 'If that email needs a code, one has been sent', email };
  }

  /** Request a password-reset code. Always generic (no enumeration). */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.otp.issue(email, 'password_reset');
    }
    return { message: 'If that email exists, a code has been sent' };
  }

  /** Verify a reset code → set the new password → revoke all sessions. */
  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const result = await this.otp.verify(input.email, 'password_reset', input.code, {
      consume: true,
    });
    this.assertOtpOk(result);

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnprocessableEntityException('Invalid or expired code');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(input.password) },
      }),
      // Revoke every active refresh token — force re-login everywhere.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Password updated' };
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

  /** Map a generic OTP failure to a safe client message (detailed logs stay server-side). */
  private assertOtpOk(result: OtpVerifyResult): void {
    if (result.ok) return;
    if (result.reason === 'locked') {
      throw new UnprocessableEntityException('Too many attempts. Request a new code.');
    }
    throw new UnprocessableEntityException('Invalid or expired code');
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
