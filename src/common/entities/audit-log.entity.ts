import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  targetType: string; // e.g., 'TIME_OFF_REQUEST', 'BALANCE'

  @Column()
  targetId: string;

  @Column()
  action: string; // e.g., 'CREATE', 'APPROVE', 'SYNC_ADJUST'

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({ nullable: true })
  performedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
