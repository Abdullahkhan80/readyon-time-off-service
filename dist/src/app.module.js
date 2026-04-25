"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const time_off_module_1 = require("./time-off/time-off.module");
const hcm_module_1 = require("./hcm/hcm.module");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const mock_hcm_controller_1 = require("./mock-hcm/mock-hcm.controller");
const employee_entity_1 = require("./time-off/entities/employee.entity");
const time_off_balance_entity_1 = require("./time-off/entities/time-off-balance.entity");
const time_off_request_entity_1 = require("./time-off/entities/time-off-request.entity");
const idempotency_key_entity_1 = require("./common/entities/idempotency-key.entity");
const audit_log_entity_1 = require("./common/entities/audit-log.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: process.env.DATABASE_NAME || 'database.sqlite',
                entities: [employee_entity_1.Employee, time_off_balance_entity_1.TimeOffBalance, time_off_request_entity_1.TimeOffRequest, idempotency_key_entity_1.IdempotencyKey, audit_log_entity_1.AuditLog],
                synchronize: true,
                enableWAL: true,
            }),
            time_off_module_1.TimeOffModule,
            hcm_module_1.HcmModule,
        ],
        controllers: [app_controller_1.AppController, mock_hcm_controller_1.MockHcmController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map