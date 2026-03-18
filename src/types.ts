// ─── Request context extracted from incoming HTTP requests ───
export interface RequestContext {
  ip: string;
  userId?: string;
  apiKey?: string;
  method: string; // GET, POST, etc.
  path: string; // /api/login, /api/search, etc.
}

// ─── Configuration for a single rate limit window ───
export interface WindowConfig {
  limit: number;
  windowMs: number;
}

// ─── Full rate limiter configuration ───
export interface RateLimiterConfig {
  default: WindowConfig;
  endpoints: Record<string, WindowConfig>; // keyed by "METHOD:PATH" e.g. "POST:/api/login"
  keyStrategy: string[]; // e.g. ["ip", "endpoint"]
}

// ─── Result returned after checking a request against the limiter ───
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number; // milliseconds until the window resets
  reason?: string; // human-readable explanation (only present when blocked)
}

// ─── Internal state for a single sliding window ───
export interface WindowState {
  prevCount: number;
  currCount: number;
  windowStart: number; // timestamp when current window began
}
