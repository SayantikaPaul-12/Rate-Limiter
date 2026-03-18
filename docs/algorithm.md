# Algorithm — Sliding Window Counter

[← Back to README](../README.md)

## Why This Algorithm?

| Algorithm | Memory | Accuracy | Burst Handling |
|-----------|--------|----------|---------------|
| Fixed Window | O(1) | Low — allows 2× burst at edges | Poor |
| Sliding Window Log | O(N) | Exact | Good |
| Token Bucket | O(1) | Good | Allows controlled bursts |
| **Sliding Window Counter** | **O(1)** | **Very good** | **Good** |

We chose it for O(1) memory, high accuracy, and clean implementation. Cloudflare uses this approach.

## How It Works

Fixed windows have a burst problem — a user can send `limit` requests at the end of one window and `limit` more at the start of the next:

```
Window 1          Window 2
|............████|████............|
              100  100 ← 200 requests in seconds!
```

The sliding window fixes this by blending two windows:

```
|----prev window----|----current window----|
                          ↑ 70% through

weight = 1 - (elapsed / windowSize) = 0.30
estimatedCount = prevCount × 0.30 + currentCount
```

### Step by Step

1. Request arrives → compute elapsed time since window started
2. Window expired? → rotate: current becomes previous, reset current to 0, align to window boundary
3. Calculate weight → `1 - elapsed / windowMs`
4. Estimate count → `prevCount × weight + currCount`
5. If `estimatedCount >= limit` → reject with 429 and accurate `retryAfter`
6. Otherwise → increment `currCount`, return remaining capacity

Each key stores just 3 values: `prevCount`, `currCount`, `windowStart` (~24 bytes per key).

## When to Use a Different Algorithm

| Scenario | Better Choice |
|----------|--------------|
| Need exact per-request tracking | Sliding Window Log |
| Want controlled bursts for idle users | Token Bucket |
| Simplicity over accuracy | Fixed Window |
| Smooth output rate (queue-like) | Leaky Bucket |

[← Back to README](../README.md)
