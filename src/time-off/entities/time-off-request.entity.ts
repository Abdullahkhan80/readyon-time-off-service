import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { Employee } from './employee.entity';

export enum RequestStatus {
  SUBMITTED = 'SUBMITTED',       // Initial state
  PENDING = 'PENDING',           // Manager review
  APPROVED = 'APPROVED',         // Final success
  REJECTED = 'REJECTED',         // Final failure
  SYNC_FAILED = 'SYNC_FAILED',   // HCM deduction failed
}

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column({ type: 'varchar', length: 20, default: RequestStatus.SUBMITTED })
  status: RequestStatus;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  requestedHours: number;

  @Column({ nullable: true, type: 'varchar' })
  managerComment: string | null;

  @Column({ nullable: true })
  hcmTransactionId: string;

  @ManyToOne(() => Employee, (employee) => employee.requests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
