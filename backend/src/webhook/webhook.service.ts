/*
  🧠 PRODUCTION-GRADE WEBHOOK HANDLER
  - Signature verification
  - Idempotency (event deduplication)
  - Race condition protection (transaction + row lock)
*/

import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Payment } from '../entities/payment.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { Subscription } from '../entities/subscription.entity';

@Injectable()
export class WebhookService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  });

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(WebhookEvent)
    private readonly webhookRepo: Repository<WebhookEvent>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    private readonly dataSource: DataSource, // 👈 IMPORTANT
  ) {}

  async handleStripeEvent(body: Buffer, signature: string) {
    let event: any;

    // =========================
    // 1. VERIFY SIGNATURE
    // =========================
    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      console.log('❌ Invalid signature');
      throw new Error('Invalid webhook signature');
    }

    console.log('📩 Event received:', event.type, event.id);

    // =========================
    // 2. IDEMPOTENCY CHECK
    // =========================
    const exists = await this.webhookRepo.findOne({
      where: { stripeEventId: event.id },
    });

    if (exists) {
      console.log('🟡 Duplicate event ignored:', event.id);
      return;
    }

    // =========================
    // 3. SAVE EVENT FIRST
    // =========================
    await this.webhookRepo.save({
      stripeEventId: event.id,
      type: event.type,
      payload: event,
    });

    console.log('🟢 Event saved:', event.id);

    // =========================
    // 4. HANDLE ONLY IMPORTANT EVENTS
    // =========================
    if (event.type === 'payment_intent.succeeded') {
      await this.handleSuccess(event);
    }

    if (event.type === 'payment_intent.payment_failed') {
      await this.handleFailure(event);
    }
  }

  // =========================
  // SUCCESS HANDLER (SAFE)
  // =========================
private async handleSuccess(event: any) {
  const paymentIntent = event.data.object;

  await this.dataSource.transaction(async (manager) => {

    // 🔒 LOCK PAYMENT
    const payment = await manager.findOne(Payment, {
      where: { stripePaymentIntentId: paymentIntent.id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!payment) {
      console.log('⚠️ Payment not found');
      return;
    }

    // ✅ Already processed?
    if (payment.status === 'succeeded') {
      console.log('🟡 Already succeeded');
      return;
    }

    // ✅ Update payment
    payment.status = 'succeeded';
    await manager.save(payment);

    console.log('✅ Payment updated');

    // =========================
    // 🔥 CREATE SUBSCRIPTION
    // =========================

    // check if already exists
    const existingSub = await manager.findOne(Subscription, {
      where: { payment: { id: payment.id } },
    });

    if (existingSub) {
      console.log('🟡 Subscription already exists');
      return;
    }

    const subscription = manager.create(Subscription, {
      userId: payment.userId,
      status: 'active',
      activatedAt: new Date(),
      payment: payment,
      planName: 'Basic', // MVP hardcoded
    });

    await manager.save(subscription);

    console.log('🔥 Subscription created');
  });
}

  // =========================
  // FAILURE HANDLER (SAFE)
  // =========================
  private async handleFailure(event: any) {
    const paymentIntent = event.data.object;

    console.log('❌ Processing FAILURE:', paymentIntent.id);

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { stripePaymentIntentId: paymentIntent.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        console.log('⚠️ Payment not found');
        return;
      }

      if (payment.status === 'failed') {
        console.log('🟡 Already failed, skipping');
        return;
      }

      payment.status = 'failed';
      payment.failureReason =
        paymentIntent.last_payment_error?.message;

      await manager.save(payment);

      console.log('❌ Payment marked failed');
    });
  }
}