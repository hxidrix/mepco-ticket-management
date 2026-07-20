import 'dotenv/config';

const nodeEnvironments = ['development', 'test', 'production'] as const;
type NodeEnvironment = (typeof nodeEnvironments)[number];

function readString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? fallback : value;
}

function readOptionalString(name: string, fallback = ''): string {
  return process.env[name]?.trim() ?? fallback;
}

function readInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be either true or false`);
}

function readNodeEnvironment(): NodeEnvironment {
  const value = readString('NODE_ENV', 'development');
  if (!nodeEnvironments.includes(value as NodeEnvironment)) {
    throw new Error(`NODE_ENV must be one of: ${nodeEnvironments.join(', ')}`);
  }
  return value as NodeEnvironment;
}

function readSecret(name: string, fallback: string): string {
  const value = readString(name, fallback);
  if (value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return value;
}

const nodeEnv = readNodeEnvironment();
const jwtAccessSecret = readSecret('JWT_ACCESS_SECRET', 'local-development-access-secret-change-me-now');
const jwtRefreshSecret = readSecret('JWT_REFRESH_SECRET', 'local-development-refresh-secret-change-me');
if (jwtAccessSecret === jwtRefreshSecret) throw new Error('JWT access and refresh secrets must be different');

export const env = Object.freeze({
  nodeEnv,
  host: readString('HOST', '127.0.0.1'),
  port: readInteger('PORT', 5000, 1, 65_535),
  corsOrigin: readString('CORS_ORIGIN', 'http://localhost:5173'),
  logLevel: readString('LOG_LEVEL', 'info'),
  database: Object.freeze({
    host: readString('DB_HOST', 'localhost'),
    port: readInteger('DB_PORT', 3306, 1, 65_535),
    user: readString('DB_USER', 'root'),
    password: readOptionalString('DB_PASSWORD'),
    name: readString('DB_NAME', 'mepco_help_desk'),
    connectionLimit: readInteger('DB_CONNECTION_LIMIT', 10, 1, 100),
    mysqlBinDirectory: readOptionalString('MYSQL_BIN_DIR'),
  }),
  uploadDirectory: readString('UPLOAD_DIR', 'uploads'),
  maxUploadBytes: readInteger('MAX_UPLOAD_BYTES', 5_242_880, 1_024, 25_000_000),
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTokenTtlMinutes: readInteger('ACCESS_TOKEN_TTL_MINUTES', 15, 1, 1_440),
  refreshTokenTtlDays: readInteger('REFRESH_TOKEN_TTL_DAYS', 7, 1, 90),
  refreshCookieName: readString('REFRESH_COOKIE_NAME', 'mepco_refresh'),
  refreshCookieSecure: readBoolean('REFRESH_COOKIE_SECURE', nodeEnv === 'production'),
  reopenWindowDays: readInteger('REOPEN_WINDOW_DAYS', 7, 1, 90),
});
