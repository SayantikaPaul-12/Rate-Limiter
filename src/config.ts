import { RateLimiterConfig, WindowConfig } from "./types";

// Reads a numeric env var with a fallback default
function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

// Scans process.env for endpoint-specific overrides.
// Convention: RATE_LIMIT_METHOD_PATH=limit
// Example:    RATE_LIMIT_POST_LOGIN=10  →  "POST:/api/login" → { limit: 10 }
function loadEndpointOverrides(windowMs: number): Record<string, WindowConfig> {
  const overrides: Record<string, WindowConfig> = {};
  const prefix = "RATE_LIMIT_";
  const skip = new Set(["RATE_LIMIT_DEFAULT", "RATE_LIMIT_WINDOW_MS", "RATE_LIMIT_KEY_STRATEGY"]);

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || skip.has(key) || !value) continue;

    // RATE_LIMIT_POST_LOGIN → ["POST", "LOGIN"] → "POST:/api/login"
    const parts = key.slice(prefix.length).split("_");
    if (parts.length < 2) continue;

    const method = parts[0].toUpperCase();
    const path = "/api/" + parts.slice(1).join("/").toLowerCase();
    overrides[`${method}:${path}`] = { limit: parseInt(value, 10), windowMs };
  }

  return overrides;
}

// Builds the full configuration from environment variables
export function loadConfig(): RateLimiterConfig {
  const limit = envInt("RATE_LIMIT_DEFAULT", 100);
  const windowMs = envInt("RATE_LIMIT_WINDOW_MS", 60_000);

  const strategyRaw = process.env.RATE_LIMIT_KEY_STRATEGY || "ip";
  const keyStrategy = strategyRaw.split(",").map((s) => s.trim());

  return {
    default: { limit, windowMs },
    endpoints: loadEndpointOverrides(windowMs),
    keyStrategy,
  };
}

// Resolves the effective limit for a given method+path.
// Checks for endpoint-specific override first, falls back to default.
export function getLimit(
  config: RateLimiterConfig,
  method: string,
  path: string
): WindowConfig {
  const key = `${method.toUpperCase()}:${path}`;
  return config.endpoints[key] ?? config.default;
}
