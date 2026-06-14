import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  private client(): OAuth2Client {
    if (!this.configured) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }
    return new OAuth2Client({
      clientId: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
    });
  }

  /** Consent URL. Requests calendar.events as an incremental scope for later sync. */
  getAuthUrl(): string {
    return this.client().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });
  }

  /** Exchanges the code, then creates or links the user by googleId/email. */
  async handleCallback(code: string): Promise<{ id: string; email: string; name: string; avatarUrl: string | null; timezone: string }> {
    const client = this.client();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new ServiceUnavailableException('Google did not return an id_token');
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new ServiceUnavailableException('Incomplete Google profile');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? email.split('@')[0];
    const avatarUrl = payload.picture ?? null;
    const refreshToken = tokens.refresh_token ?? undefined;

    // Link by googleId, else by email, else create + personal workspace.
    let user = await this.prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatarUrl: user.avatarUrl ?? avatarUrl,
          ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
        },
      });
    } else {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email, name, avatarUrl, googleId, googleRefreshToken: refreshToken },
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
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
    };
  }
}
