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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeOffController = void 0;
const common_1 = require("@nestjs/common");
const time_off_service_1 = require("./time-off.service");
const create_request_dto_1 = require("./dto/create-request.dto");
const approve_reject_dto_1 = require("./dto/approve-reject.dto");
let TimeOffController = class TimeOffController {
    timeOffService;
    constructor(timeOffService) {
        this.timeOffService = timeOffService;
    }
    async getBalance(employeeId) {
        return this.timeOffService.getBalances(employeeId);
    }
    async createRequest(createDto, idempotencyKey) {
        return this.timeOffService.createRequest(createDto, idempotencyKey);
    }
    async approveRequest(id, actionDto) {
        return this.timeOffService.approveRequest(id, actionDto);
    }
    async rejectRequest(id, actionDto) {
        return this.timeOffService.rejectRequest(id, actionDto);
    }
    async syncWithHcm() {
        return this.timeOffService.reconcileBalances();
    }
};
exports.TimeOffController = TimeOffController;
__decorate([
    (0, common_1.Get)('balance'),
    __param(0, (0, common_1.Query)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TimeOffController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Post)('request'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_request_dto_1.CreateTimeOffRequestDto, String]),
    __metadata("design:returntype", Promise)
], TimeOffController.prototype, "createRequest", null);
__decorate([
    (0, common_1.Post)('approve/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_reject_dto_1.ManagerActionDto]),
    __metadata("design:returntype", Promise)
], TimeOffController.prototype, "approveRequest", null);
__decorate([
    (0, common_1.Post)('reject/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approve_reject_dto_1.ManagerActionDto]),
    __metadata("design:returntype", Promise)
], TimeOffController.prototype, "rejectRequest", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TimeOffController.prototype, "syncWithHcm", null);
exports.TimeOffController = TimeOffController = __decorate([
    (0, common_1.Controller)('time-off'),
    __metadata("design:paramtypes", [time_off_service_1.TimeOffService])
], TimeOffController);
//# sourceMappingURL=time-off.controller.js.map