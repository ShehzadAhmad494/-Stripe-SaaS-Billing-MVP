import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class WebhookService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia', // ⚠️ stable version use karo
  });

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async handleStripeEvent(body: Buffer, signature: string) {
    let event: any; // later we will remove any and use proper types

    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      console.log('❌ Signature verification failed');
      throw new Error('Invalid webhook signature');
    }

    console.log('✅ Verified Event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handleSuccess(event);
        break;

      case 'payment_intent.payment_failed':
        await this.handleFailure(event);
        break;

      default:
        console.log('⚠️ Unhandled event:', event.type);
    }
  }

  private async handleSuccess(event: any) {
    const paymentIntent = event.data.object as any;

    console.log('💰 Payment SUCCESS:', paymentIntent.id);

    await this.paymentRepository.update(
      { stripePaymentIntentId: paymentIntent.id },
      { status: 'succeeded' },
    );

    console.log('✅ DB updated → succeeded');
  }

  private async handleFailure(event: any) {
    const paymentIntent = event.data.object as any;

    console.log('❌ Payment FAILED:', paymentIntent.id);

    await this.paymentRepository.update(
      { stripePaymentIntentId: paymentIntent.id },
      {
        status: 'failed',
        failureReason:
          paymentIntent.last_payment_error?.message,
      },
    );

    console.log('❌ DB updated → failed');
  }
}