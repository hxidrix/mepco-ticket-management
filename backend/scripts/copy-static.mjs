import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = resolve('src/database/migrations');
const destination = resolve('dist/database/migrations');

await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });
