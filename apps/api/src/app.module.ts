import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccessModule } from './access/access.module';
import { MailModule } from './mail/mail.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectsModule } from './projects/projects.module';
import { StatusesModule } from './statuses/statuses.module';
import { TasksModule } from './tasks/tasks.module';
import { PlannerModule } from './planner/planner.module';
import { EventsModule } from './events/events.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port || 6379) };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    JwtModule.register({ global: true }),
    BullModule.forRoot({ connection: redisConnection() }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AccessModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    StatusesModule,
    TasksModule,
    PlannerModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
