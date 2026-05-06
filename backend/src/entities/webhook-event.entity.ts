import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    unique: true,
  })
  stripeEventId: string;

  @Column()
  type: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  payload: Record<string, any>;

  @Column({ default: 'pending' })
status: 'pending' | 'processed' | 'failed';

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  processedAt: Date;
}