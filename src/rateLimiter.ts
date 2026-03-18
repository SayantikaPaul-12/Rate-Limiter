import { RequestContext, RateLimitResult, RateLimiterConfig } from "./types";
import { getLimit } from "./config";
import { resolveKey } from "./keyResolver";
import { checkLimit } from "./slidingWindow";

// Orchestrator: ties together config resolution, key building, and the algorithm.
// This is the single entry point for checking whether a request should be allowed.
export function checkRequest(
  config: RateLimiterConfig,
  ctx: RequestContext
): RateLimitResult & { key: string } {
  // 1. Resolve the effective limit for this endpoint
  const windowConfig = getLimit(config, ctx.method, ctx.path);

  // 2. Build the composite key from the request context
  const key = resolveKey(ctx, config.keyStrategy);

  // 3. Run the sliding window check
  const result = checkLimit(key, windowConfig.limit, windowConfig.windowMs);

  // 4. Attach a reason when blocked (no user identity — avoid leaking data)
  if (!result.allowed) {
    result.reason =
      `Rate limit exceeded on ${ctx.method} ${ctx.path}. ` +
      `Limit: ${windowConfig.limit} requests per ${windowConfig.windowMs / 1000}s.`;
  }

  return { ...result, key };
}
