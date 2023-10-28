# Redis limiting for ioredis

Redis-based rate limiting using the token bucket algorithm.

This project is an adaptation for Node.js, inspired by [go-redis](https://github.com/go-redis/redis_rate).

Enjoy the benefits of the token bucket algorithm for both JavaScript and TypeScript developers.

# Installation

```shell
npm install @koshnic/ratelimit
```

# Usage

```javascript
const Redis = require("ioredis");
const RateLimiter = require("ratelimit");

const redis = new Redis({
    host: 'localhost',
    port: 6379
});

const limiter = new RateLimiter(redis);
let res;

// Allow 10 requests per second
res = await limiter.allowPerSecond('project:123', 10);

// Allow 20 requests per minute
res = await limiter.allowPerMinute('project:456', 20);

// Allow 30 requests per hour
res = await limiter.allowPerHour('project:789', 30);

// Or you want to use raw allow function to meet your custom logic.
res = await limiter.allow('project:cutom_login', {
    burst: 10,
    ratePerPeriod: 10,
    period: 60,
    cost: 1
});
```

# License

MIT

