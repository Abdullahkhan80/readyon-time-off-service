import { createConnection } from 'typeorm';
import { Employee } from '../src/time-off/entities/employee.entity';
import { TimeOffBalance } from '../src/time-off/entities/time-off-balance.entity';
import { TimeOffRequest } from '../src/time-off/entities/time-off-request.entity';
import { IdempotencyKey } from '../src/common/entities/idempotency-key.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';

async function checkDb() {
  const connection = await createConnection({
    type: 'sqlite',
    database: 'database.sqlite',
    entities: [Employee, TimeOffBalance, TimeOffRequest, IdempotencyKey, AuditLog],
  });

  const employeeCount = await connection.getRepository(Employee).count();
  const balanceCount = await connection.getRepository(TimeOffBalance).count();
  
  console.log(`Employees: ${employeeCount}`);
  console.log(`Balances: ${balanceCount}`);

  if (employeeCount > 0) {
    const employees = await connection.getRepository(Employee).find();
    console.log('Employees list:', JSON.stringify(employees, null, 2));
  }

  if (balanceCount > 0) {
    const balances = await connection.getRepository(TimeOffBalance).find();
    console.log('Balances list:', JSON.stringify(balances, null, 2));
  }

  await connection.close();
}

checkDb().catch(console.error);
