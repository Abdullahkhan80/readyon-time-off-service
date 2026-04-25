import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, VersionColumn } from 'typeorm';
import { Employee } from './employee.entity';

@Entity('time_off_balances')
export class TimeOffBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number; // Current total balance from HCM

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reservedBalance: number; // Balance "held" for PENDING requests

  @Column({ type: 'varchar', length: 50, default: 'PTO' })
  type: string;

  @VersionColumn()
  version: number; // For Optimistic Locking

  @ManyToOne(() => Employee, (employee) => employee.balances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;
}
