import { Global, Module } from '@nestjs/common';
import { RealtimeEmitter } from './realtime.emitter';
import { RealtimeGateway } from './realtime.gateway';
import { ChatModule } from '../chat/chat.module';

@Global()
@Module({
  imports: [ChatModule],
  providers: [RealtimeEmitter, RealtimeGateway],
  exports: [RealtimeEmitter],
})
export class RealtimeModule {}
