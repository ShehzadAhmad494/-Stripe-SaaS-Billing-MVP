import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PaymentModule } from './payment/payment.module';
import { WebhookModule } from './webhook/webhook.module';
import { StripeService } from './stripe/stripe.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,

      ssl: {
        rejectUnauthorized: false,
      },

      autoLoadEntities: true,
      synchronize: true,

      // removed:
      // logging: true
    }),

    PaymentModule,
    WebhookModule,
  ],

  controllers: [AppController],
  providers: [AppService, StripeService],
})
export class AppModule {}