"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const employee_entity_1 = require("../src/time-off/entities/employee.entity");
const time_off_balance_entity_1 = require("../src/time-off/entities/time-off-balance.entity");
const time_off_request_entity_1 = require("../src/time-off/entities/time-off-request.entity");
const idempotency_key_entity_1 = require("../src/common/entities/idempotency-key.entity");
const audit_log_entity_1 = require("../src/common/entities/audit-log.entity");
async function checkDb() {
    const connection = await (0, typeorm_1.createConnection)({
        type: 'sqlite',
        database: 'database.sqlite',
        entities: [employee_entity_1.Employee, time_off_balance_entity_1.TimeOffBalance, time_off_request_entity_1.TimeOffRequest, idempotency_key_entity_1.IdempotencyKey, audit_log_entity_1.AuditLog],
    });
    const employeeCount = await connection.getRepository(employee_entity_1.Employee).count();
    const balanceCount = await connection.getRepository(time_off_balance_entity_1.TimeOffBalance).count();
    console.log(`Employees: ${employeeCount}`);
    console.log(`Balances: ${balanceCount}`);
    if (employeeCount > 0) {
        const employees = await connection.getRepository(employee_entity_1.Employee).find();
        console.log('Employees list:', JSON.stringify(employees, null, 2));
    }
    if (balanceCount > 0) {
        const balances = await connection.getRepository(time_off_balance_entity_1.TimeOffBalance).find();
        console.log('Balances list:', JSON.stringify(balances, null, 2));
    }
    await connection.close();
}
checkDb().catch(console.error);
//# sourceMappingURL=check-db.js.map