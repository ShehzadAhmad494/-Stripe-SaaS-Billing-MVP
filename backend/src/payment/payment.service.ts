import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from '../entities/payment.entity';
import { StripeService } from '../stripe/stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    private readonly stripeService: StripeService,
  ) {}

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    const { userId, amount, currency, idempotencyKey } = dto;

    console.log('==============================');
    console.log('🔵 NEW PAYMENT REQUEST RECEIVED');
    console.log({ userId, amount, currency, idempotencyKey });
    console.log('==============================');

    // 1. Check duplicate request
    const existingPayment = await this.paymentRepository.findOne({
      where: { idempotencyKey },
    });

    if (existingPayment) {
      console.log('🟡 DUPLICATE REQUEST DETECTED');

      // 🔥 FIX: ALWAYS RETURN STORED CLIENT SECRET (NO EXTRA STRIPE CALL)
      if (!existingPayment.clientSecret) {
        throw new BadRequestException(
          'Corrupted payment record: missing clientSecret',
        );
      }

      console.log('♻️ Returning existing payment from DB');
      console.log({
        paymentId: existingPayment.id,
        stripePaymentIntentId: existingPayment.stripePaymentIntentId,
        status: existingPayment.status,
      });

      return {
        clientSecret: existingPayment.clientSecret, // store in db for duplicate request 
        message: 'Existing payment reused (idempotent response)',
      };
    }

    console.log('🟢 NO EXISTING PAYMENT FOUND');
    console.log('➡ Creating new Stripe PaymentIntent...');

    // 2. Create Stripe PaymentIntent
    const paymentIntent =
      await this.stripeService.createPaymentIntent({
        amount,
        currency,
        metadata: { userId },
      });

    if (!paymentIntent.client_secret) {
      console.log('🔴 Stripe returned no client_secret');
      throw new BadRequestException('Failed to create payment intent');
    }

    console.log('🟢 Stripe PaymentIntent created');
    console.log({
      id: paymentIntent.id,
      clientSecret: true,
    });

    // 3. Save in DB (IMPORTANT: store clientSecret)
    const payment = this.paymentRepository.create({
      userId,
      amount,
      currency,
      idempotencyKey,
      stripePaymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret, // ✅ REQUIRED FIX
      status: 'pending',
    });

    await this.paymentRepository.save(payment);

    console.log('🟢 Payment saved in DB');
    console.log({
      dbId: payment.id,
      status: payment.status,
    });

    // 4. Response
    console.log('➡ Returning clientSecret to frontend');

    return {
      clientSecret: paymentIntent.client_secret,
    };
  }
}