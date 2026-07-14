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

function readNodeEnvironment(): NodeEnvironment {
  const value = readString('NODE_ENV', 'development');
  if (!nodeEnvironments.includes(value as NodeEnvironment)) {
    throw new Error(`NODE_ENV must be one of: ${nodeEnvironments.join(', ')}`);
  }
  return value as NodeEnvironment;
}

export const env = Object.freeze({
  nodeEnv: readNodeEnvironment(),
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
  }),
  uploadDirectory: readString('UPLOAD_DIR', 'uploads'),
  maxUploadBytes: readInteger('MAX_UPLOAD_BYTES', 5_242_880, 1_024, 25_000_000),
});

