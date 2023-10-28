"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function (resolve) {
            resolve(value);
        });
    }

    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }

        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }

        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }

        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", {value: true});
exports.RateLimiter = void 0;
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

class RateLimiter {
    constructor(redisClient) {
        this.redis = redisClient;
        this.scriptSha = null;
    }

    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.scriptSha = (yield this.redis.script('LOAD', allowAtMost));
        });
    }

    allow(key, rate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.scriptSha) {
                yield this.init();
            }
            const result = yield this.redis.evalsha(this.scriptSha, 1, `rate_limit:${key}`, rate.burst.toString(), rate.ratePerPeriod.toString(), rate.period.toString(), rate.cost.toString());
            return {
                allowed: Number(result[0]),
                remaining: Number(result[1]),
                retryAfter: Number(result[2]),
                resetAfter: Number(result[3]),
            };
        });
    }

    allowPerSecond(key, rate, seconds = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.allow(key, {
                burst: rate,
                ratePerPeriod: rate,
                period: seconds,
                cost: 1
            });
        });
    }

    allowPerMinute(key, rate, minutes = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.allow(key, {
                burst: rate,
                ratePerPeriod: rate,
                period: minutes * 60,
                cost: 1
            });
        });
    }

    allowPerHour(key, rate, hours = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.allow(key, {
                burst: rate,
                ratePerPeriod: rate,
                period: hours * 3600,
                cost: 1
            });
        });
    }
}

exports.RateLimiter = RateLimiter;
