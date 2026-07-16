import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [FirebaseModule],
  controllers: [PushController],
  providers: [PushService],
})
export class PushModule {}
