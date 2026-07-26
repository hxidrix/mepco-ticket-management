import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { del, get, put } from '@vercel/blob';

import { env } from '../config/env.js';
import { AppError } from './app-error.js';

interface AttachmentToStore {
  buffer: Buffer;
  mimeType: string;
  storedName: string;
  relativeDirectory: string;
}

export type OpenedAttachment =
  | { kind: 'local'; path: string }
  | { kind: 'stream'; stream: Readable };

function blobOptions(): { token: string } | Record<string, never> {
  return env.blobReadWriteToken === '' ? {} : { token: env.blobReadWriteToken };
}

function isVercelBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

function validatedLocalPath(locator: string): string {
  const uploadRoot = resolve(env.uploadDirectory);
  const storagePath = resolve(locator);
  if (!storagePath.startsWith(`${uploadRoot}${sep}`) && storagePath !== uploadRoot) {
    throw new AppError(500, 'ATTACHMENT_PATH_INVALID', 'The attachment storage path is invalid');
  }
  return storagePath;
}

export async function storeAttachment(input: AttachmentToStore): Promise<string> {
  if (env.attachmentStorage === 'vercel-blob') {
    const blob = await put(
      `ticket-attachments/${input.relativeDirectory}/${input.storedName}`,
      input.buffer,
      {
        access: 'private',
        addRandomSuffix: false,
        contentType: input.mimeType,
        cacheControlMaxAge: 3_600,
        ...blobOptions(),
      },
    );
    return blob.url;
  }

  const directory = resolve(env.uploadDirectory, input.relativeDirectory);
  const storagePath = resolve(directory, input.storedName);
  await mkdir(directory, { recursive: true });
  await writeFile(storagePath, input.buffer, { flag: 'wx' });
  return storagePath;
}

export async function deleteAttachment(locator: string): Promise<void> {
  if (isVercelBlobUrl(locator)) {
    await del(locator, blobOptions());
    return;
  }
  await unlink(validatedLocalPath(locator));
}

export async function openAttachment(locator: string): Promise<OpenedAttachment> {
  if (!isVercelBlobUrl(locator)) {
    return { kind: 'local', path: validatedLocalPath(locator) };
  }

  const result = await get(locator, { access: 'private', ...blobOptions() });
  if (result === null || result.statusCode !== 200) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'The attachment file was not found');
  }

  return {
    kind: 'stream',
    stream: Readable.from(result.stream as AsyncIterable<Uint8Array>),
  };
}
