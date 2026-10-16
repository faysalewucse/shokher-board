const express = require("express");
const path = require("path");
const compression = require("compression");
const config = require("./config");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const { apiLimiter } = require("./middleware/rateLimiter");
const security = require("./middleware/security");
const requestLogger = require("./middleware/requestLogger");
const globalAuditMiddleware = require("./middleware/globalAuditMiddleware");
const { successResponse } = require("./utils/responseHandler");
const { version } = require("../package.json");

const app = express();
const { apiPrefix } = config;

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(security.helmet);
app.use(security.cors);

// Compression middleware
app.use(compression());

// Body parsing middleware - skip multipart/form-data to allow file uploads
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return next(); // Skip body parsers for file uploads
  }
  express.json({ limit: "50mb" })(req, res, next);
});

app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return next(); // Skip body parsers for file uploads
  }
  express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
});

// Request logging
app.use(requestLogger);

// Rate limiting (disabled in development)
if (config.nodeEnv !== "development") {
  app.use(apiPrefix, apiLimiter);
}

// Static files (uploads) — allow cross-origin so frontend on a different port can load images
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// Global audit logging for all mutating requests
app.use(apiPrefix, globalAuditMiddleware);

// API routes
app.use(apiPrefix, routes);

// Root endpoint
app.get("/", (req, res) => {
  return successResponse(res, {
    message: "Welcome to the ShokherBoard API",
    data: {
      version,                                          // server build (package.json)
      apiVersion: apiPrefix.split("/").pop() || "v1",   // e.g. "v1" from /api/v1
      docs: `${apiPrefix}/health`,
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
