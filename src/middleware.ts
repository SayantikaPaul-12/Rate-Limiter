import { Request, Response, NextFunction } from "express";
import { RateLimiterConfig, RequestContext } from "./types";
import { checkRequest } from "./rateLimiter";

// Extracts rate-limit-relevant fields from an Express request
function extractContext(req: Request): RequestContext {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
    userId: req.headers["x-user-id"] as string | undefined,
    apiKey: req.headers["x-api-key"] as string | undefined,
    method: req.method,
    path: req.path,
  };
}

// Express middleware factory.
// Attach to your app with: app.use(createRateLimitMiddleware(config))
export function createRateLimitMiddleware(config: RateLimiterConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = extractContext(req);
    const result = checkRequest(config, ctx);

    // Always set rate limit headers — even on successful requests
    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Date.now() + result.retryAfterMs);

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.status(429).json({
        error: "Rate limit exceeded",
        reason: result.reason,
        limit: result.limit,
        remaining: 0,
        retryAfterMs: result.retryAfterMs,
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}
