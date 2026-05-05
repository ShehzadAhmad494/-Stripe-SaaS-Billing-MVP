import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async handleWebhook(
    @Req() req: Request & { rawBody: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    console.log('📩 Incoming webhook...');

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    try {
      // 🔥 IMPORTANT FIX: rawBody use karo
      await this.webhookService.handleStripeEvent(
        req.rawBody, // ✅ THIS IS THE FIX
        signature,
      );

      return { received: true };
    } catch (error: any) {
      console.log('❌ Webhook Error:', error.message);
      throw new BadRequestException(error.message);
    }
  }
}