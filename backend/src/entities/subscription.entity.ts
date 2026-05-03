import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { Payment } from './payment.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    nullable: true,
  })
  stripeSubscriptionId: string;

  @Column({
    nullable: true,
  })
  planName: string;

  @Column({
    type: 'varchar',
    default: 'inactive',
  })
  status: 'active' | 'inactive';

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  activatedAt: Date;

  @OneToOne(() => Payment)
  @JoinColumn()
  payment: Payment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}