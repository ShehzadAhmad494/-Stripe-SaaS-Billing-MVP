import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: any;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia' as any,
    });
  }

  async retrievePaymentIntent(id: string) {
  return this.stripe.paymentIntents.retrieve(id);
}

  // 1. Create Payment Intent
  async createPaymentIntent(data: {
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
  }) {
    return this.stripe.paymentIntents.create({
      amount: data.amount,
      currency: data.currency,
      metadata: data.metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  // 2. Verify webhook signature (we will use later)
  constructEvent(payload: any, signature: string, secret: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
  }
}
