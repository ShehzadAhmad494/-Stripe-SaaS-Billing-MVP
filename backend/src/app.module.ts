import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PaymentModule } from './payment/payment.module';
import { WebhookModule } from './webhook/webhook.module';
import { StripeService } from './stripe/stripe.service';
import { StripeModule } from './stripe/stripe.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
     // 🔥 DEBUG LINE
  

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
    StripeModule,
  ],
  

  controllers: [AppController],
  providers: [AppService, StripeService],
})
export class AppModule {}