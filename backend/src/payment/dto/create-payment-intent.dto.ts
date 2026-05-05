import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}