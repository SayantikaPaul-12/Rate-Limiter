import { createHash } from "crypto";
import { RequestContext } from "./types";

// Hashes sensitive values so raw API keys and IPs are never stored in memory
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

// Maps strategy field names to their values from the request context.
// Sensitive fields (ip, apiKey) are hashed to prevent exposure via dashboard or logs.
const fieldExtractors: Record<string, (ctx: RequestContext) => string> = {
  ip: (ctx) => `ip:${hash(ctx.ip)}`,
  userId: (ctx) => ctx.userId ?? "anonymous",
  apiKey: (ctx) => `key:${hash(ctx.apiKey ?? "none")}`,
  endpoint: (ctx) => `${ctx.method}:${ctx.path}`,
};

// Builds a composite key from the request context based on the configured strategy.
// Example: strategy ["userId", "endpoint"] + context { userId: "u_42", method: "POST", path: "/api/login" }
//        → "u_42|POST:/api/login"
export function resolveKey(
  ctx: RequestContext,
  strategy: string[]
): string {
  return strategy
    .map((field) => {
      const extractor = fieldExtractors[field];
      if (!extractor) {
        throw new Error(`Unknown key strategy field: "${field}". Valid fields: ${Object.keys(fieldExtractors).join(", ")}`);
      }
      return extractor(ctx);
    })
    .join("|");
}
