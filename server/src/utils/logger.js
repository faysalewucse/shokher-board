const config = require('../config');

// ── ANSI Colors ──────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

// ── Helpers ──────────────────────────────────────────────────
const timestamp = () => {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${c.gray}${time}.${ms}${c.reset}`;
};

const levelConfig = {
  info: { badge: `${c.bgBlue}${c.bold}${c.white} INFO  ${c.reset}`, color: c.blue },
  success: { badge: `${c.bgGreen}${c.bold}${c.white}  OK   ${c.reset}`, color: c.green },
  warn: { badge: `${c.bgYellow}${c.bold}${c.black} WARN  ${c.reset}`, color: c.yellow },
  error: { badge: `${c.bgRed}${c.bold}${c.white} ERROR ${c.reset}`, color: c.red },
  debug: { badge: `${c.bgMagenta}${c.bold}${c.white} DEBUG ${c.reset}`, color: c.magenta },
  http: { badge: `${c.bgCyan}${c.bold}${c.black}  HTTP ${c.reset}`, color: c.cyan },
};

const print = (level, ...args) => {
  if (level === 'debug' && config.nodeEnv === 'production') return;

  const { badge, color } = levelConfig[level];
  const msg = args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : a))
    .join(' ');

  console.log(`  ${timestamp()}  ${badge}  ${color}${msg}${c.reset}`);
};

// ── HTTP Request Logger ──────────────────────────────────────
const methodColors = {
  GET: c.green,
  POST: c.blue,
  PUT: c.yellow,
  PATCH: c.yellow,
  DELETE: c.red,
};

const statusColor = (code) => {
  if (code >= 500) return c.red;
  if (code >= 400) return c.yellow;
  if (code >= 300) return c.cyan;
  return c.green;
};

const httpLog = (method, url, status, duration) => {
  const mc = methodColors[method] || c.white;
  const sc = statusColor(status);
  const methodPad = method.padEnd(7);
  const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;

  console.log(
    `  ${timestamp()}  ${levelConfig.http.badge}  ${mc}${c.bold}${methodPad}${c.reset} ${c.white}${url}${c.reset}  ${sc}${c.bold}${status}${c.reset}  ${c.gray}${durationStr}${c.reset}`
  );
};

// ── Startup Banner ───────────────────────────────────────────
const banner = (port, env) => {
  const line = '─'.repeat(48);
  console.log();
  console.log(`  ${c.gray}${line}${c.reset}`);
  console.log(`  ${c.bold}${c.blue}  ▲  ShokherBoard API${c.reset}`);
  console.log(`  ${c.gray}${line}${c.reset}`);
  console.log(`  ${c.gray}  ●${c.reset}  ${c.bold}Local:${c.reset}        ${c.cyan}http://localhost:${port}${c.reset}`);
  console.log(`  ${c.gray}  ●${c.reset}  ${c.bold}Environment:${c.reset}  ${env === 'production' ? `${c.green}${env}` : `${c.yellow}${env}`}${c.reset}`);
  console.log(`  ${c.gray}${line}${c.reset}`);
  console.log();
};

// ── Public API ───────────────────────────────────────────────
const logger = {
  info: (...args) => print('info', ...args),
  success: (...args) => print('success', ...args),
  warn: (...args) => print('warn', ...args),
  error: (...args) => print('error', ...args),
  debug: (...args) => print('debug', ...args),
  http: httpLog,
  banner,
};

module.exports = logger;
