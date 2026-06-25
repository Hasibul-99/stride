import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { GoogleAuthService } from './google-auth.service';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [JwtModule.register({}), OtpModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, GoogleAuthService],
  exports: [TokenService],
})
export class AuthModule {}
