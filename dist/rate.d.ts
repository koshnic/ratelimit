import Redis from 'ioredis';
export interface Rate {
    /**
     * The maximum number of requests allowed to burst at once.
     * Essentially, it allows a user to exceed the rate up to this limit.
     */
    burst: number;
    /**
     * The number of tokens (or requests) added per period.
     * For example, for a rate of "10 requests per minute", this value would be 10.
     */
    ratePerPeriod: number;
    /**
     * The duration of the period in seconds. For example, if you want to allow 10 requests per minute,
     * you would set ratePerPeriod to 10 and period to 60.
     */
    period: number;
    /**
     * Number of tokens a request costs. This allows for weighted requests.
     * When cost is 1, the `allowed` value in the result will only be 0 or 1.
     * When cost is more than 1, the `allowed` value will show the number of requests that are allowed
     * based on the current token count in the bucket.
     */
    cost: number;
}
export interface AllowResult {
    /**
     * The number of requests that are allowed at this time.
     * For cost = 1, the value will be 1 (allowed) or 0 (not allowed).
     * For cost > 1, this will reflect the actual number of allowed requests based on the available tokens.
     */
    allowed: number;
    /**
     * The number of tokens (requests) left in the bucket after the current request.
     */
    remaining: number;
    /**
     * When the rate limiter will allow the next request. If the request is currently allowed, the value is -1.
     * This is a timestamp in seconds.
     */
    retryAfter: number;
    /**
     * The time until the rate limits completely reset.
     * This is a timestamp in seconds.
     */
    resetAfter: number;
}
export declare class RateLimiter {
    private redis;
    private scriptSha;
    constructor(redisClient: Redis);
    init(): Promise<void>;
    allow(key: string, rate: Rate): Promise<AllowResult>;
    allowPerSecond(key: string, rate: number, seconds?: number): Promise<AllowResult>;
    allowPerMinute(key: string, rate: number, minutes?: number): Promise<AllowResult>;
    allowPerHour(key: string, rate: number, hours?: number): Promise<AllowResult>;
}
