# API Reference

[← Back to README](../README.md)

## Rate-Limited Endpoints

| Method | Path | Limit | Override |
|--------|------|-------|----------|
| POST | `/api/login` | 10/min | Yes |
| POST | `/api/signup` | 5/min | Yes |
| GET | `/api/search` | 50/min | Yes |
| GET | `/api/data` | 100/min | Default |
| GET | `/api/settings` | 100/min | Default |

```bash
curl -X POST http://localhost:3000/api/login -H "X-User-Id: user_alice"
```

## Response Headers

Every response includes:

```
X-RateLimit-Limit: 100           # max requests in window
X-RateLimit-Remaining: 73        # requests left
X-RateLimit-Reset: 1710600060000 # when window resets (ms)
Retry-After: 43                  # seconds to wait (only on 429)
```

## 429 Response Body

```json
{
  "error": "Rate limit exceeded",
  "reason": "Rate limit exceeded for user_alice on POST /api/login. Limit: 10 requests per 60s.",
  "limit": 10,
  "remaining": 0,
  "retryAfterMs": 43000,
  "retryAfterSeconds": 43
}
```

## Dashboard API (not rate-limited)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard/status` | Current config and all active windows |
| POST | `/dashboard/simulate` | Simulate a request (used by dashboard UI) |
| POST | `/dashboard/config` | Update config at runtime |
| POST | `/dashboard/reset` | Clear all rate limit state |

[← Back to README](../README.md)
