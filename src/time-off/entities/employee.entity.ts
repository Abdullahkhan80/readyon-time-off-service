import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TimeOffBalance } from './time-off-balance.entity';
import { TimeOffRequest } from './time-off-request.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @OneToMany(() => TimeOffBalance, (balance) => balance.employee)
  balances: TimeOffBalance[];

  @OneToMany(() => TimeOffRequest, (request) => request.employee)
  requests: TimeOffRequest[];
}
