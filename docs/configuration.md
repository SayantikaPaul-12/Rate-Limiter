# Configuration Guide

[← Back to README](../README.md)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_DEFAULT` | `100` | Max requests per window for all endpoints |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window duration in milliseconds (60s) |
| `RATE_LIMIT_KEY_STRATEGY` | `ip` | Comma-separated fields for identifying callers |
| `PORT` | `3000` | Server port |

## Per-Endpoint Overrides

Convention: `RATE_LIMIT_{METHOD}_{PATH}={limit}`

```bash
RATE_LIMIT_POST_LOGIN=10        # POST /api/login → 10/min
RATE_LIMIT_POST_SIGNUP=5        # POST /api/signup → 5/min
RATE_LIMIT_GET_SEARCH=50        # GET /api/search → 50/min
```

Endpoints without an override use `RATE_LIMIT_DEFAULT`.

## Key Strategy

Controls how the rate limiter identifies unique callers.

| Field | Source | Example |
|-------|--------|---------|
| `ip` | `req.ip` | `192.168.1.1` |
| `userId` | `X-User-Id` header | `user_alice` |
| `apiKey` | `X-Api-Key` header | `sk-abc123` |
| `endpoint` | `req.method:req.path` | `POST:/api/login` |

Combine with commas. Fields are joined with `|`:

```bash
RATE_LIMIT_KEY_STRATEGY=userId,endpoint
# → key: "user_alice|POST:/api/login"
```

Each unique key gets its own independent rate limit window.

## Resolution Order

```
1. Endpoint-specific override  →  RATE_LIMIT_POST_LOGIN=10
   ↓ (not found)
2. Default limit               →  RATE_LIMIT_DEFAULT=100
```

[← Back to README](../README.md)
