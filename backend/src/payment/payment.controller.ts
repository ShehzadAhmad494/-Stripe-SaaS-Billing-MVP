import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { StripeService } from '../stripe/stripe.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('create-intent')
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentService.createPaymentIntent(dto);
  }
  @Get('status/:paymentIntentId')
  async getStatus(@Param('paymentIntentId') id: string) {
    const paymentIntent = await this.stripeService.retrievePaymentIntent(id);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
    };
  }
}