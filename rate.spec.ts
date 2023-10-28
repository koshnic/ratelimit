import {expect} from 'chai';
import {AllowResult, RateLimiter} from './rate';
import Redis from 'ioredis';

describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;
    let redis: Redis;

    before(async () => {
        redis = new Redis();
        rateLimiter = new RateLimiter(redis);
        await rateLimiter.init();
    });

    after(() => {
        redis.disconnect();
    });

    it('should allow a single request', async () => {
        const key = 'test-key';
        const rate = 10;
        await redis.del(key);

        const res = await rateLimiter.allowPerSecond(key, rate);
        expect(res.allowed).to.equal(1);
        expect(res.remaining).to.equal(9);
    });

    it('should disallow when exceeding rate', async () => {
        const key = 'test-key2';
        const rate = 10;
        await redis.del(key);

        for (let i = 0; i < 10; i++) {
            await rateLimiter.allowPerSecond(key, rate);
        }
        const res = await rateLimiter.allowPerSecond(key, rate);
        expect(res.allowed).to.equal(0);
    });

    it('should handle different rate and cost correctly', async () => {
        const key = 'test-key3';
        await redis.del(key);

        const res = await rateLimiter.allow(key, {
            burst: 20,
            ratePerPeriod: 10,
            period: 60,
            cost: 5
        });
        expect(res.allowed).to.equal(5);
        expect(res.remaining).to.be.above(0);
    });

    it('should allow ratePerPeriod number of requests after the burst limit is reached', async function () {
        this.timeout(5000); // Set timeout to 5 seconds for this test
        const key = 'burst-rate-key';
        await redis.del(key);

        const rate = {
            burst: 5,
            ratePerPeriod: 5,
            period: 15,
            cost: 1
        };
        for (let i = 0; i < 5; i++) {
            await rateLimiter.allow(key, rate);
        }
        // Add a delay of 3 seconds according to rate.
        await new Promise(resolve => setTimeout(resolve, 3000));
        const res = await rateLimiter.allow(key, rate);
        expect(res.allowed).to.equal(1);
        expect(res.remaining).to.equal(0);
    });

    it('should return remaining when cost exceeds it', async () => {
        const key = 'cost-exceed-key';
        await redis.del(key);

        const rate = {
            burst: 5,
            ratePerPeriod: 10,
            period: 60,
            cost: 6
        };
        const res = await rateLimiter.allow(key, rate);
        expect(res.allowed).to.equal(5);
        expect(res.remaining).to.equal(0);
    });

    it('should disallow request when remaining is zero', async () => {
        const key = 'zero-remaining-key';
        await redis.del(key);

        const rate = {
            burst: 1,
            ratePerPeriod: 5,
            period: 60,
            cost: 1
        };
        await rateLimiter.allow(key, rate); // this should consume the only available token
        const res = await rateLimiter.allow(key, rate);
        expect(res.allowed).to.equal(0);
        expect(res.remaining).to.equal(0);
    });

    it('should return correct resetAfter and retryAfter values', async () => {
        const key = 'reset-retry-key';
        await redis.del(key);

        const rate = {
            burst: 1,
            ratePerPeriod: 1,
            period: 60,
            cost: 1
        };
        const res = await rateLimiter.allow(key, rate);
        expect(res.resetAfter).to.be.closeTo(60, 5); // should be close to 60 seconds
        expect(res.retryAfter).to.equal(-1); // should be allowed
    });
});

