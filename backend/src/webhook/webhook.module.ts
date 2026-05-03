import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from 'src/entities/webhook-event.entity';
import { Payment } from 'src/entities/payment.entity';
import { Subscription } from 'src/entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent,Payment,Subscription]), 
  ],
  controllers: [WebhookController],
  providers: [WebhookService]
})
export class WebhookModule {}
