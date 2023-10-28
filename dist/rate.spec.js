"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const rate_1 = require("./rate");
const ioredis_1 = __importDefault(require("ioredis"));
describe('RateLimiter', () => {
    let rateLimiter;
    let redis;
    before(() => __awaiter(void 0, void 0, void 0, function* () {
        redis = new ioredis_1.default();
        rateLimiter = new rate_1.RateLimiter(redis);
        yield rateLimiter.init();
    }));
    after(() => {
        redis.disconnect();
    });
    it('should allow a single request', () => __awaiter(void 0, void 0, void 0, function* () {
        const key = 'test-key';
        const rate = 10;
        yield redis.del(key);
        const res = yield rateLimiter.allowPerSecond(key, rate);
        (0, chai_1.expect)(res.allowed).to.equal(1);
        (0, chai_1.expect)(res.remaining).to.equal(9);
    }));
    it('should disallow when exceeding rate', () => __awaiter(void 0, void 0, void 0, function* () {
        const key = 'test-key2';
        const rate = 10;
        yield redis.del(key);
        for (let i = 0; i < 10; i++) {
            yield rateLimiter.allowPerSecond(key, rate);
        }
        const res = yield rateLimiter.allowPerSecond(key, rate);
        (0, chai_1.expect)(res.allowed).to.equal(0);
    }));
    it('should handle different rate and cost correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const key = 'test-key3';
        yield redis.del(key);
        const res = yield rateLimiter.allow(key, {
            burst: 20,
            ratePerPeriod: 10,
            period: 60,
            cost: 5
        });
        (0, chai_1.expect)(res.allowed).to.equal(5);
        (0, chai_1.expect)(res.remaining).to.be.above(0);
    }));
    it('should allow ratePerPeriod number of requests after the burst limit is reached', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000); // Set timeout to 5 seconds for this test
            const key = 'burst-rate-key';
            yield redis.del(key);
            const rate = {
                burst: 5,
                ratePerPeriod: 5,
                period: 15,
                cost: 1
            };
            for (let i = 0; i < 5; i++) {
                yield rateLimiter.allow(key, rate);
            }
            // Add a delay of 3 seconds according to rate.
            yield new Promise(resolve => setTimeout(resolve, 3000));
            const res = yield rateLimiter.allow(key, rate);
            (0, chai_1.expect)(res.allowed).to.equal(1);
            (0, chai_1.expect)(res.remaining).to.equal(0);
        });
    });
    it('should return remaining when cost exceeds it', () => __awaiter(void 0, void 0, void 0, function* () {
        const key = 'cost-exceed-key';
        yield redis.del(key);
        const rate = {
            burst: 5,
            ratePerPeriod: 10,
            period: 60,
            cost: 6
        };
        const res = yield rateLimiter.allow(key, rate);
        (0, chai_1.expect)(res.allowed).to.equal(5);
        (0, chai_1.expect)(res.remaining).to.equal(0);
    }));
    it('should disallow request when remaining is zero', () => __awaiter(void 0, void 0, void 0, function* () {
        const key = 'zero-remaining-key';
        yield redis.del(key);
        const rate = {
            burst: 1,
            ratePerPeriod: 5,
            period: 60,
            cost: 1
        };
        yield rateLimiter.allow(key, rate); // this should consume the only available token
        const res = yield rateLimiter.allow(key, rate);
        (0, chai_1.expect)(res.allowed).to.equal(0);
        (0, chai_1.expect)(res.remaining).to.equal(0);
    }));
    it('should return correct resetAfter and retryAfter values', () => __awaiter(void 0, void 0, void 0, function* () {
        const key = 'reset-retry-key';
        yield redis.del(key);
        const rate = {
            burst: 1,
            ratePerPeriod: 1,
            period: 60,
            cost: 1
        };
        const res = yield rateLimiter.allow(key, rate);
        (0, chai_1.expect)(res.resetAfter).to.be.closeTo(60, 5); // should be close to 60 seconds
        (0, chai_1.expect)(res.retryAfter).to.equal(-1); // should be allowed
    }));
});
