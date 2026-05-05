import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Index({ unique: true })
  @Column()
  stripePaymentIntentId: string;

  @Index({ unique: true })
  @Column()
  idempotencyKey: string;

  @Column('int')
  amount: number;

  @Column()
  currency: string;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: 'pending' | 'succeeded' | 'failed';
  
  @Column({ nullable: true })
clientSecret: string;

  @Column({
    nullable: true,
  })
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}