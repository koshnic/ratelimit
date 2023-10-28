import Redis from 'ioredis';

// Copyright (c)
// Source: https://github.com/go-redis/redis_rate/blob/v10/lua.go
const allowAtMost = `
-- this script has side-effects, so it requires replicate commands mode
redis.replicate_commands()

local rate_limit_key = KEYS[1]
local burst = ARGV[1]
local rate = ARGV[2]
local period = ARGV[3]
local cost = tonumber(ARGV[4])

local emission_interval = period / rate
local burst_offset = emission_interval * burst

-- redis returns time as an array containing two integers: seconds of the epoch
-- time (10 digits) and microseconds (6 digits). for convenience we need to
-- convert them to a floating point number. the resulting number is 16 digits,
-- bordering on the limits of a 64-bit double-precision floating point number.
-- adjust the epoch to be relative to Jan 1, 2017 00:00:00 GMT to avoid floating
-- point problems. this approach is good until "now" is 2,483,228,799 (Wed, 09
-- Sep 2048 01:46:39 GMT), when the adjusted value is 16 digits.
local jan_1_2017 = 1483228800
local now = redis.call("TIME")
now = (now[1] - jan_1_2017) + (now[2] / 1000000)

local tat = redis.call("GET", rate_limit_key)

if not tat then
  tat = now
else
  tat = tonumber(tat)
end

tat = math.max(tat, now)

local diff = now - (tat - burst_offset)
local remaining = diff / emission_interval

if remaining < 1 then
  local reset_after = tat - now
  local retry_after = emission_interval - diff
  return {
    0, -- allowed
    0, -- remaining
    tostring(retry_after),
    tostring(reset_after),
  }
end

if remaining < cost then
  cost = remaining
  remaining = 0
else
  remaining = remaining - cost
end

local increment = emission_interval * cost
local new_tat = tat + increment

local reset_after = new_tat - now
if reset_after > 0 then
  redis.call("SET", rate_limit_key, new_tat, "EX", math.ceil(reset_after))
end

return {
  cost,
  remaining,
  tostring(-1),
  tostring(reset_after),
}
`;

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


export class RateLimiter {
    private redis: Redis;
    private scriptSha: string | null;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
        this.scriptSha = null;
    }

    async init(): Promise<void> {
        this.scriptSha = await this.redis.script('LOAD', allowAtMost) as string;
    }

    async allow(key: string, rate: Rate): Promise<AllowResult> {
        if (!this.scriptSha) {
            await this.init();
        }
        const result: any = await this.redis.evalsha(
            this.scriptSha as string,
            1,
            `rate_limit:${key}`,
            rate.burst.toString(),
            rate.ratePerPeriod.toString(),
            rate.period.toString(),
            rate.cost.toString());
        return {
            allowed: Number(result[0]),
            remaining: Number(result[1]),
            retryAfter: Number(result[2]),
            resetAfter: Number(result[3]),
        };
    }

    async allowPerSecond(key: string, rate: number, seconds: number = 1): Promise<AllowResult> {
        return this.allow(key, {
            burst: rate,
            ratePerPeriod: rate,
            period: seconds,
            cost: 1
        });
    }

    async allowPerMinute(key: string, rate: number, minutes: number = 1): Promise<AllowResult> {
        return this.allow(key, {
            burst: rate,
            ratePerPeriod: rate,
            period: minutes * 60,
            cost: 1
        });
    }

    async allowPerHour(key: string, rate: number, hours: number = 1): Promise<AllowResult> {
        return this.allow(key, {
            burst: rate,
            ratePerPeriod: rate,
            period: hours * 3600,
            cost: 1
        });
    }
}
