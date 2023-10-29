# Rate limit for ioredis

Redis-based rate limiting using the token bucket algorithm.

This project is an adaptation for Node.js, inspired by [go-redis](https://github.com/go-redis/redis_rate).

# Why use ratelimit

- **Easy to use**

  Integrate with just two lines of code. The library's design allows for tailored usage to best fit your application's
  needs.

- **Scalability**

  Being Redis-based, ratelimit is inherently scalable. Whether you're handling hundreds or millions of requests, the
  library scales gracefully with your application.

- **Built for Modern Web**

  Whether it's traditional web applications, microservices, or serverless functions, ratelimit is designed for the
  modern web's diverse deployment scenarios.

- **TypeScript Support**

  With built-in TypeScript definitions, developers can benefit from type-safety and autocompletion, improving the
  development experience.

# Installation

```shell
npm install @koshnic/ratelimit
```

# Usage

**Note**: 
- All rate limit keys stored in Redis will be prefixed with `rate_limit:`. For example, when you
invoke `limiter.allowPerSecond('project:123', 10)`, the corresponding key name in Redis will be `rate_limit:project:123`.
- Please note that this library does not handle errors internally. It's recommended that users implement their own error handling mechanisms when integrating with this library to ensure robust and resilient applications.

```javascript
const Redis = require("ioredis");
const {RateLimiter} = require('@koshnic/ratelimit');

const redis = new Redis({
    host: 'localhost',
    port: 6379
});

const limiter = new RateLimiter(redis);
let res;

// Allow 10 requests per second, default 1 second for period
res = await limiter.allowPerSecond('project:123', 10);
console.log('PerSecond - allowed: ', res.allowed, ' remaining: ', res.remaining, ' retryAfter:', res.retryAfter, ' resetAfter:', res.resetAfter);

// Allow 10 requests per 20 seconds, override default seconds.
res = await limiter.allowPerSecond('project:456', 10, 20);

// Allow 20 requests per minute, default 1 minute for period
res = await limiter.allowPerMinute('project:456', 20);

// Allow 30 requests per hour, default 1 hour for period
res = await limiter.allowPerHour('project:789', 30);

// Or you want to use raw allow function to meet your custom logic.
res = await limiter.allow('project:cutom_logic', {
    burst: 10,
    ratePerPeriod: 10,
    period: 60,
    cost: 1
});
```

# License

MIT

