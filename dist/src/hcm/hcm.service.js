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
var HcmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HcmService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const CircuitBreaker = require('opossum');
let HcmService = HcmService_1 = class HcmService {
    httpService;
    logger = new common_1.Logger(HcmService_1.name);
    breaker;
    hcmBaseUrl = 'http://localhost:3000/mock-hcm';
    constructor(httpService) {
        this.httpService = httpService;
        const options = {
            timeout: 5000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000,
        };
        this.breaker = new CircuitBreaker(this.callHcm.bind(this), options);
    }
    async callHcm(endpoint, method, data) {
        const url = `${this.hcmBaseUrl}${endpoint}`;
        let attempt = 0;
        const maxRetries = 3;
        while (attempt <= maxRetries) {
            try {
                const response = await (0, rxjs_1.firstValueFrom)(method === 'GET'
                    ? this.httpService.get(url)
                    : this.httpService.post(url, data));
                return response.data;
            }
            catch (error) {
                attempt++;
                if (attempt > maxRetries)
                    throw error;
                const delay = process.env.NODE_ENV === 'test' ? 1 : Math.pow(2, attempt) * 500;
                this.logger.warn(`HCM call failed. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    async validateBalance(employeeId, hours, locationId) {
        try {
            const data = await this.breaker.fire(`/balance/${employeeId}?locationId=${locationId}`, 'GET');
            return data.balance >= hours;
        }
        catch (error) {
            this.handleError(error, 'validateBalance');
            return false;
        }
    }
    async deductBalance(employeeId, hours, requestId, locationId) {
        try {
            const data = await this.breaker.fire('/deduct', 'POST', { employeeId, hours, requestId, locationId });
            return data.transactionId;
        }
        catch (error) {
            this.handleError(error, 'deductBalance');
            throw error;
        }
    }
    async getBalancesSnapshot() {
        try {
            const data = await this.breaker.fire('/sync-snapshot', 'POST');
            return Array.isArray(data) ? data : [];
        }
        catch (error) {
            this.logger.error(`Error in HCM Service [getBalancesSnapshot]: ${error.message}`);
            return [];
        }
    }
    handleError(error, context) {
        if (error instanceof common_1.ServiceUnavailableException || error instanceof common_1.InternalServerErrorException) {
            throw error;
        }
        this.logger.error(`Error in HCM Service [${context}]: ${error.message}`);
        const status = error.response?.status || 500;
        const message = error.response?.data?.message || 'External HCM integration error';
        if (status === 400)
            throw new common_1.InternalServerErrorException(message);
        throw new common_1.ServiceUnavailableException('External HCM system is having issues.');
    }
};
exports.HcmService = HcmService;
exports.HcmService = HcmService = HcmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], HcmService);
//# sourceMappingURL=hcm.service.js.map