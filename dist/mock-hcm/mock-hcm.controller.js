"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MockHcmController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockHcmController = void 0;
const common_1 = require("@nestjs/common");
let MockHcmController = MockHcmController_1 = class MockHcmController {
    logger = new common_1.Logger(MockHcmController_1.name);
    mockBalances = {
        '123e4567-e89b-12d3-a456-426614174000': 160,
    };
    async getBalance(employeeId) {
        this.simulateRandomFailure();
        const balance = this.mockBalances[employeeId] ?? 0;
        this.logger.log(`Mock HCM: Fetching balance for ${employeeId} -> ${balance}`);
        return { balance, type: 'PTO' };
    }
    async deductBalance(body) {
        this.simulateRandomFailure();
        const { employeeId, hours, requestId } = body;
        const currentBalance = this.mockBalances[employeeId] ?? 0;
        if (currentBalance < hours) {
            this.logger.warn(`Mock HCM: Insufficient balance for ${employeeId}. Requested: ${hours}, Available: ${currentBalance}`);
            throw new common_1.HttpException('Insufficient balance in HCM', common_1.HttpStatus.BAD_REQUEST);
        }
        this.mockBalances[employeeId] -= hours;
        this.logger.log(`Mock HCM: Deducted ${hours} for ${employeeId} (RequestId: ${requestId}). New Balance: ${this.mockBalances[employeeId]}`);
        return { status: 'SUCCESS', transactionId: `hcm-tx-${Date.now()}` };
    }
    async getSnapshot() {
        return Object.entries(this.mockBalances).map(([employeeId, balance]) => ({
            employeeId,
            balance,
            type: 'PTO',
        }));
    }
    simulateRandomFailure() {
        const failureChance = process.env.HCM_FAILURE_CHANCE ? parseFloat(process.env.HCM_FAILURE_CHANCE) : 0;
        if (Math.random() < failureChance) {
            this.logger.error('Mock HCM: Simulating a random failure (500)');
            throw new common_1.HttpException('External Service Error', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.MockHcmController = MockHcmController;
__decorate([
    (0, common_1.Get)('balance/:employeeId'),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MockHcmController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Post)('deduct'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MockHcmController.prototype, "deductBalance", null);
__decorate([
    (0, common_1.Post)('sync-snapshot'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MockHcmController.prototype, "getSnapshot", null);
exports.MockHcmController = MockHcmController = MockHcmController_1 = __decorate([
    (0, common_1.Controller)('mock-hcm')
], MockHcmController);
//# sourceMappingURL=mock-hcm.controller.js.map