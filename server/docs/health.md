# Health Check

Base path: `/health`

Public endpoint for monitoring service health.

---

## GET `/health`

**Response `200`:**
```json
{
  "success": true,
  "message": "Server is running",
  "data": {
    "version":   "0.1.0",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime":    86400,
    "database":  "connected",
    "memory":    { "rss": "85.3 MB" }
  }
}
```

`database` is `"disconnected"` if a `SELECT 1` against PostgreSQL fails; the endpoint itself still returns `200`.
