import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  forgotPasswordSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signinSchema,
  signupSchema,
  verifyEmailSchema,
  type AuthUser,
} from '@teamboard/shared';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService, type AuthResult, type OtpIssuedResult } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { TokenService } from './token.service';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from './cookie';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleAuthService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  private get isProd(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private respond(res: Response, result: AuthResult): AuthResponse {
    setRefreshCookie(res, result.refreshToken, this.isProd);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(signupSchema))
  @ApiOperation({ summary: 'Create an unverified account + email a verification code' })
  async signup(@Body() body: typeof signupSchema._type): Promise<OtpIssuedResult> {
    return this.auth.signup(body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  @ApiOperation({ summary: 'Verify the signup code → issue tokens' })
  async verifyEmail(
    @Body() body: typeof verifyEmailSchema._type,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.verifyEmail(body));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-otp')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(resendOtpSchema))
  @ApiOperation({ summary: 'Re-send an OTP (registration or password reset)' })
  async resendOtp(@Body() body: typeof resendOtpSchema._type): Promise<OtpIssuedResult> {
    return this.auth.resendOtp(body.email, body.purpose);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  @ApiOperation({ summary: 'Request a password-reset code (generic response)' })
  async forgotPassword(
    @Body() body: typeof forgotPasswordSchema._type,
  ): Promise<{ message: string }> {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  @ApiOperation({ summary: 'Reset the password with an OTP code' })
  async resetPassword(
    @Body() body: typeof resetPasswordSchema._type,
  ): Promise<{ message: string }> {
    return this.auth.resetPassword(body);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signin')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(signinSchema))
  @ApiOperation({ summary: 'Sign in with email + password' })
  async signin(
    @Body() body: typeof signinSchema._type,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.signin(body));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token, issue new access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    return this.respond(res, await this.auth.refresh(raw));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke refresh token + clear cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(raw);
    clearRefreshCookie(res, this.isProd);
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Redirect to Google consent screen' })
  googleStart(@Res() res: Response): void {
    res.redirect(this.google.getAuthUrl());
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback — create/link user' })
  async googleCallback(@Query('code') code: string, @Res() res: Response): Promise<void> {
    const user = await this.google.handleCallback(code);
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken(user.id, user.email),
      this.tokens.issueRefreshToken(user.id),
    ]);
    setRefreshCookie(res, refreshToken, this.isProd);
    const frontend = this.config.getOrThrow<string>('FRONTEND_URL');
    res.redirect(`${frontend}/auth/callback#token=${accessToken}`);
  }
}
