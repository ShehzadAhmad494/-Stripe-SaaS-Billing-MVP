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

    private readonly dataSource: DataSource,
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
      console.log({
        level: 'error',
        message: 'Invalid webhook signature',
      });
      throw new Error('Invalid webhook signature');
    }

    console.log({
      level: 'info',
      eventId: event.id,
      type: event.type,
      step: 'received',
    });

    // =========================
    // 2. IDEMPOTENCY CHECK
    // =========================
    const exists = await this.webhookRepo.findOne({
      where: { stripeEventId: event.id },
    });

    if (exists) {
      console.log({
        level: 'warn',
        eventId: event.id,
        type: event.type,
        decision: 'ignored',
        reason: 'duplicate_event',
      });
      return;
    }

    // =========================
    // 3. SAVE EVENT FIRST
    // =========================
    await this.webhookRepo.save({
      stripeEventId: event.id,
      type: event.type,
      payload: event,
      status: 'pending',
    });

    console.log({
      level: 'info',
      eventId: event.id,
      step: 'saved_to_db',
    });

    // =========================
    // 4. ROUTING
    // =========================
    try {
      if (event.type === 'payment_intent.succeeded') {
        await this.handleSuccess(event);
      }

      if (event.type === 'payment_intent.payment_failed') {
        await this.handleFailure(event);
      }

      // ✅ mark processed
      await this.webhookRepo.update(
        { stripeEventId: event.id },
        { status: 'processed' },
      );

      console.log({
        level: 'info',
        eventId: event.id,
        step: 'completed',
      });

    } catch (error) {
      console.log({
        level: 'error',
        eventId: event.id,
        message: error.message,
        step: 'processing_failed',
      });

      throw error; // Stripe retry
    }
  }

  // =========================
  // SUCCESS HANDLER (SELF-HEALING ADDED)
  // =========================
  private async handleSuccess(event: any) {
    const paymentIntent = event.data.object;

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { stripePaymentIntentId: paymentIntent.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        console.log({
          level: 'warn',
          eventId: event.id,
          decision: 'skipped',
          reason: 'payment_not_found',
        });
        return;
      }

      // 🔥 ALWAYS CHECK SUBSCRIPTION FIRST (SELF-HEALING CORE)
      const existingSub = await manager.findOne(Subscription, {
        where: { payment: { id: payment.id } },
      });

      // =========================
      // CASE 1: FULLY DONE
      // =========================
      if (payment.status === 'succeeded' && existingSub) {
        console.log({
          level: 'info',
          eventId: event.id,
          decision: 'skipped',
          reason: 'already_processed',
        });
        return;
      }

      // =========================
      // CASE 2: PAYMENT NOT UPDATED YET
      // =========================
      if (payment.status !== 'succeeded') {
        payment.status = 'succeeded';
        await manager.save(payment);

        console.log({
          level: 'info',
          eventId: event.id,
          action: 'payment_updated',
        });
      }

      // =========================
      // CASE 3: SUBSCRIPTION MISSING (SELF-HEAL)
      // =========================
      if (!existingSub) {
        const subscription = manager.create(Subscription, {
          userId: payment.userId,
          status: 'active',
          activatedAt: new Date(),
          payment: payment,
          planName: 'Basic',
        });

        await manager.save(subscription);

        console.log({
          level: 'info',
          eventId: event.id,
          action: 'subscription_created',
        });
      }
    });
  }

  // =========================
  // FAILURE HANDLER
  // =========================
  private async handleFailure(event: any) {
    const paymentIntent = event.data.object;

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { stripePaymentIntentId: paymentIntent.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        console.log({
          level: 'warn',
          eventId: event.id,
          decision: 'skipped',
          reason: 'payment_not_found',
        });
        return;
      }

      if (payment.status === 'failed') {
        console.log({
          level: 'warn',
          eventId: event.id,
          decision: 'skipped',
          reason: 'already_failed',
        });
        return;
      }

      payment.status = 'failed';
      payment.failureReason =
        paymentIntent.last_payment_error?.message;

      await manager.save(payment);

      console.log({
        level: 'info',
        eventId: event.id,
        action: 'payment_failed_updated',
      });
    });
  }
}