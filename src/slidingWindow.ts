import { WindowState, RateLimitResult } from "./types";

// In-memory store: maps rate limit keys to their window state
const store = new Map<string, WindowState>();

// Calculates how long until the weighted estimate drops below the limit.
//
// Two phases to consider:
//   Phase 1 (still in current window): prevCount's weight is shrinking as time passes
//   Phase 2 (after window rotates): currCount becomes prevCount and starts decaying
function calculateRetryAfter(
  prevCount: number,
  currCount: number,
  elapsed: number,
  limit: number,
  windowMs: number
): number {
  const timeToRotation = windowMs - elapsed;

  // Phase 1: Can prev window decay enough before the current window ends?
  // Need: prevCount × (1 - (elapsed + t) / windowMs) + currCount < limit
  // Solve: t > windowMs × (1 - (limit - currCount) / prevCount) - elapsed
  if (prevCount > 0 && currCount < limit) {
    const spaceNeeded = limit - currCount;
    const t = windowMs * (1 - spaceNeeded / prevCount) - elapsed;
    if (t > 0 && t < timeToRotation) {
      return Math.ceil(t) + 1; // +1ms buffer to cross the boundary
    }
  }

  // Phase 2: After rotation, currCount becomes the new prevCount, currCount resets to 0.
  // New estimate = currCount × (1 - t'/windowMs), where t' is time after rotation.
  if (currCount < limit) {
    // Right after rotation: estimate = currCount < limit → immediately allowed
    return Math.ceil(timeToRotation) + 1;
  }

  // currCount >= limit: even after rotation, need the new prevCount to decay
  // Need: currCount × (1 - t'/windowMs) < limit (strictly less than)
  // Use (limit - 1) to guarantee the estimate drops below the limit, not just equal
  // Example: currCount=10, limit=10 → decay = windowMs × (1 - 9/10) = 10% of window
  const decayAfterRotation = windowMs * (1 - (limit - 1) / currCount);
  return Math.ceil(timeToRotation + decayAfterRotation);
}

// Sliding Window Counter algorithm.
//
// Instead of hard window boundaries (which allow bursts at edges),
// we blend the previous and current window counts based on how far
// into the current window we are.
//
//   |----prev window----|----current window----|
//                             ↑ 70% through
//   estimatedCount = prevCount × 0.30 + currentCount
//
// This gives a smooth, accurate count without storing individual timestamps.
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let state = store.get(key);

  // First request for this key — initialize a fresh window
  if (!state) {
    state = { prevCount: 0, currCount: 1, windowStart: now };
    store.set(key, state);
    return { allowed: true, limit, remaining: limit - 1, retryAfterMs: 0 };
  }

  const elapsed = now - state.windowStart;

  // Current window has expired — rotate: current becomes previous.
  // Align windowStart to the window boundary (not "now") so elapsed time
  // within the new window is preserved. This ensures the sliding weight
  // is accurate after rotation.
  if (elapsed >= windowMs) {
    const windowsPassed = Math.floor(elapsed / windowMs);
    if (windowsPassed >= 2) {
      // More than 2 full windows passed — all data is stale
      state.prevCount = 0;
    } else {
      state.prevCount = state.currCount;
    }
    state.currCount = 0;
    state.windowStart += windowsPassed * windowMs;
  }

  // Weight of the previous window that still overlaps with our sliding view
  const weight = Math.max(0, 1 - (now - state.windowStart) / windowMs);
  const estimatedCount = state.prevCount * weight + state.currCount;

  if (estimatedCount >= limit) {
    const retryAfterMs = calculateRetryAfter(
      state.prevCount, state.currCount, elapsed, limit, windowMs
    );
    return { allowed: false, limit, remaining: 0, retryAfterMs };
  }

  // Request is allowed — increment and return remaining capacity
  state.currCount++;
  const remaining = Math.max(0, Math.floor(limit - (estimatedCount + 1)));
  return { allowed: true, limit, remaining, retryAfterMs: 0 };
}

// Returns current state for a key (used by the dashboard API)
export function getWindowState(key: string): WindowState | undefined {
  return store.get(key);
}

// Returns all tracked keys and their states (used by the dashboard API)
export function getAllStates(): Map<string, WindowState> {
  return store;
}

// Clears all stored state (useful for testing or resets)
export function resetAll(): void {
  store.clear();
}

// Removes stale keys that haven't been active for 2× the window duration.
// Prevents unbounded memory growth in long-running servers.
export function startCleanup(windowMs: number, intervalMs: number = 60_000): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, state] of store) {
      if (now - state.windowStart > windowMs * 2) {
        store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[rate-limiter] Cleanup: removed ${cleaned} stale keys, ${store.size} remaining`);
    }
  }, intervalMs);
}
