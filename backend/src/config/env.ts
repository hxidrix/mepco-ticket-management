import 'dotenv/config';

const nodeEnvironments = ['development', 'test', 'production'] as const;
type NodeEnvironment = (typeof nodeEnvironments)[number];
const databaseSslModes = ['disabled', 'required', 'verify_identity'] as const;
type DatabaseSslMode = (typeof databaseSslModes)[number];
const attachmentStorageDrivers = ['local', 'vercel-blob'] as const;
type AttachmentStorageDriver = (typeof attachmentStorageDrivers)[number];

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

function readChoice<T extends string>(name: string, choices: readonly T[], fallback: T): T {
  const value = readString(name, fallback);
  if (!choices.includes(value as T)) {
    throw new Error(`${name} must be one of: ${choices.join(', ')}`);
  }
  return value as T;
}

function readDatabaseSettings(): {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  connectionLimit: number;
  mysqlBinDirectory: string;
  sslMode: DatabaseSslMode;
  sslCaBase64: string;
} {
  const databaseUrl = readOptionalString('DATABASE_URL');
  const sslMode = readChoice(
    'DB_SSL_MODE',
    databaseSslModes,
    process.env.VERCEL === '1' ? 'verify_identity' : 'disabled',
  );
  const shared = {
    connectionLimit: readInteger('DB_CONNECTION_LIMIT', 10, 1, 100),
    mysqlBinDirectory: readOptionalString('MYSQL_BIN_DIR'),
    sslMode,
    sslCaBase64: readOptionalString('DB_SSL_CA_BASE64'),
  };

  if (databaseUrl === '') {
    return {
      host: readString('DB_HOST', 'localhost'),
      port: readInteger('DB_PORT', 3306, 1, 65_535),
      user: readString('DB_USER', 'root'),
      password: readOptionalString('DB_PASSWORD'),
      name: readString('DB_NAME', 'mepco_help_desk'),
      ...shared,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid mysql:// connection URL');
  }
  if (parsed.protocol !== 'mysql:' && parsed.protocol !== 'mysql2:') {
    throw new Error('DATABASE_URL must use the mysql:// or mysql2:// protocol');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//u, ''));
  if (parsed.hostname === '' || parsed.username === '' || name === '') {
    throw new Error('DATABASE_URL must include a host, username, and database name');
  }

  return {
    host: parsed.hostname,
    port: parsed.port === '' ? 3306 : Number(parsed.port),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    name,
    ...shared,
  };
}

function readNodeEnvironment(): NodeEnvironment {
  const value = readString('NODE_ENV', 'development');
  if (!nodeEnvironments.includes(value as NodeEnvironment)) {
    throw new Error(`NODE_ENV must be one of: ${nodeEnvironments.join(', ')}`);
  }
  return value as NodeEnvironment;
}

function readSecret(name: string, fallback: string): string {
  const configured = process.env[name]?.trim();
  if ((configured === undefined || configured === '') && nodeEnv === 'production') {
    throw new Error(`${name} is required when NODE_ENV=production`);
  }
  const value = configured === undefined || configured === '' ? fallback : configured;
  if (value.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  if (nodeEnv === 'production' && /change|replace|example|development|local|generate/i.test(value)) {
    throw new Error(`${name} must be replaced with a strong deployment-specific secret`);
  }
  return value;
}

const nodeEnv = readNodeEnvironment();
const jwtAccessSecret = readSecret('JWT_ACCESS_SECRET', 'local-development-access-secret-change-me-now');
const jwtRefreshSecret = readSecret('JWT_REFRESH_SECRET', 'local-development-refresh-secret-change-me');
if (jwtAccessSecret === jwtRefreshSecret) throw new Error('JWT access and refresh secrets must be different');
const database = readDatabaseSettings();

export const env = Object.freeze({
  nodeEnv,
  host: readString('HOST', '127.0.0.1'),
  port: readInteger('PORT', 5000, 1, 65_535),
  corsOrigin: readString('CORS_ORIGIN', 'http://localhost:5173'),
  logLevel: readString('LOG_LEVEL', 'info'),
  database: Object.freeze(database),
  attachmentStorage: readChoice<AttachmentStorageDriver>(
    'ATTACHMENT_STORAGE',
    attachmentStorageDrivers,
    process.env.VERCEL === '1' ? 'vercel-blob' : 'local',
  ),
  blobReadWriteToken: readOptionalString('BLOB_READ_WRITE_TOKEN'),
  uploadDirectory: readString('UPLOAD_DIR', 'uploads'),
  maxUploadBytes: readInteger('MAX_UPLOAD_BYTES', 5_242_880, 1_024, 25_000_000),
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTokenTtlMinutes: readInteger('ACCESS_TOKEN_TTL_MINUTES', 15, 1, 1_440),
  refreshTokenTtlDays: readInteger('REFRESH_TOKEN_TTL_DAYS', 7, 1, 90),
  refreshCookieName: readString('REFRESH_COOKIE_NAME', 'mepco_refresh'),
  refreshCookieSecure: readBoolean('REFRESH_COOKIE_SECURE', nodeEnv === 'production'),
  enableApiDocs: readBoolean('ENABLE_API_DOCS', nodeEnv !== 'production'),
  enableSelfRegistration: readBoolean('ENABLE_SELF_REGISTRATION', nodeEnv !== 'production'),
  reopenWindowDays: readInteger('REOPEN_WINDOW_DAYS', 7, 1, 90),
});
