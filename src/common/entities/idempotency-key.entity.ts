import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn()
  key: string; // Typically a UUID or request ID from the client

  @Column({ type: 'text' })
  response: string; // Cached response body

  @Column()
  statusCode: number;

  @CreateDateColumn()
  createdAt: Date;
}
