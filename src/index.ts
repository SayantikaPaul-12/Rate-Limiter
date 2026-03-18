import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { loadConfig } from "./config";
import { createRateLimitMiddleware } from "./middleware";
import { checkRequest } from "./rateLimiter";
import { getAllStates, resetAll, startCleanup } from "./slidingWindow";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

// Load configuration from environment variables
let config = loadConfig();
console.log("Rate limiter loaded: default=%d/min, endpoints=%d, strategy=%s",
  config.default.limit, Object.keys(config.endpoints).length, config.keyStrategy.join(","));

// Clean up stale rate limit keys every 60 seconds
startCleanup(config.default.windowMs);

// Serve the dashboard
app.use(express.static(path.join(__dirname, "../dashboard")));

// ─── Apply rate limiter middleware to all /api routes ───
app.use("/api", createRateLimitMiddleware(config));

// ─── Demo API endpoints ───
app.post("/api/login", (_req, res) => {
  res.json({ message: "Login successful" });
});

app.post("/api/signup", (_req, res) => {
  res.json({ message: "Signup successful" });
});

app.get("/api/search", (_req, res) => {
  res.json({ results: ["item1", "item2", "item3"] });
});

app.get("/api/data", (_req, res) => {
  res.json({ data: { id: 1, value: "sample" } });
});

app.get("/api/settings", (_req, res) => {
  res.json({ settings: { theme: "dark", language: "en" } });
});

// ─── Dashboard API: returns current rate limiter state ───
app.get("/dashboard/status", (_req, res) => {
  const states = getAllStates();
  const entries: Record<string, object> = {};

  for (const [key, state] of states) {
    const elapsed = Date.now() - state.windowStart;
    const weight = Math.max(0, 1 - elapsed / config.default.windowMs);
    const estimated = Math.floor(state.prevCount * weight + state.currCount);
    entries[key] = { ...state, estimatedCount: estimated };
  }

  res.json({ config, windows: entries });
});

// ─── Dashboard API: simulate a request without going through Express middleware ───
app.post("/dashboard/simulate", (req, res) => {
  const { method, path: reqPath, userId, ip, apiKey } = req.body;
  const ctx = {
    ip: ip ?? req.ip ?? "127.0.0.1",
    userId,
    apiKey,
    method: method ?? "GET",
    path: reqPath ?? "/api/data",
  };

  const result = checkRequest(config, ctx);
  res.json(result);
});

// ─── Dashboard API: update config at runtime ───
app.post("/dashboard/config", (req, res) => {
  const { defaultLimit, windowMs, keyStrategy, endpoints } = req.body;

  // Validate inputs to prevent invalid or malicious configuration
  if (defaultLimit !== undefined) {
    if (typeof defaultLimit !== "number" || defaultLimit < 1) {
      res.status(400).json({ error: "defaultLimit must be a positive number" });
      return;
    }
    config.default.limit = defaultLimit;
  }
  if (windowMs !== undefined) {
    if (typeof windowMs !== "number" || windowMs < 1000) {
      res.status(400).json({ error: "windowMs must be at least 1000" });
      return;
    }
    config.default.windowMs = windowMs;
  }
  if (keyStrategy !== undefined) {
    const valid = ["ip", "userId", "apiKey", "endpoint"];
    if (!Array.isArray(keyStrategy) || !keyStrategy.every((k: string) => valid.includes(k))) {
      res.status(400).json({ error: `keyStrategy must be an array of: ${valid.join(", ")}` });
      return;
    }
    config.keyStrategy = keyStrategy;
  }
  if (endpoints !== undefined) config.endpoints = endpoints;

  res.json({ message: "Config updated", config });
});

// ─── Dashboard API: reset all rate limit state ───
app.post("/dashboard/reset", (_req, res) => {
  resetAll();
  res.json({ message: "All rate limit state cleared" });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Rate limiter running at http://localhost:${PORT}`);
  console.log(`Dashboard at http://localhost:${PORT}/index.html`);
});
