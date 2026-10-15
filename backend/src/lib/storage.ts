import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SavedAsset {
  assetUrl: string;
  filename: string;
  mimeType: string;
  size: number;
}

const MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
]);

// Magic byte signatures for image verification
function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  // SVG detection: begins with XML declaration or <svg tag
  const snippet = buffer.slice(0, 1024).toString('utf8').trim();
  if (snippet.startsWith('<?xml') || snippet.startsWith('<svg') || snippet.includes('<svg')) {
    // Basic anti-XSS check: SVG must not contain script tags or event handlers
    const lower = snippet.toLowerCase();
    if (lower.includes('<script') || lower.includes('javascript:') || lower.includes('onload=') || lower.includes('onerror=')) {
      return null;
    }
    return 'image/svg+xml';
  }

  return null;
}

export function getUploadDirectory(): string {
  const dir = process.env.STORAGE_DIR || path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function validateAsset(buffer: Buffer, originalFilename: string, declaredMimeType?: string): { mimeType: string; extension: string } {
  if (!buffer || buffer.length === 0) {
    const error: any = new Error('Asset payload is empty.');
    error.statusCode = 400;
    error.code = 'EMPTY_ASSET';
    throw error;
  }

  if (buffer.length > MAX_ASSET_SIZE_BYTES) {
    const error: any = new Error(`Asset exceeds maximum permitted size of ${MAX_ASSET_SIZE_BYTES / (1024 * 1024)}MB.`);
    error.statusCode = 400;
    error.code = 'ASSET_TOO_LARGE';
    throw error;
  }

  const detectedMime = detectImageMimeType(buffer);
  if (!detectedMime) {
    const error: any = new Error('Invalid or unsupported asset file format. Only valid PNG, JPEG, WebP, and safe SVG images are allowed.');
    error.statusCode = 400;
    error.code = 'INVALID_ASSET_TYPE';
    throw error;
  }

  if (declaredMimeType && declaredMimeType !== detectedMime && declaredMimeType !== 'image/jpg' && declaredMimeType !== 'application/octet-stream') {
    const error: any = new Error(`MIME type mismatch: declared '${declaredMimeType}' does not match detected '${detectedMime}'.`);
    error.statusCode = 400;
    error.code = 'MIME_TYPE_MISMATCH';
    throw error;
  }

  const ext = ALLOWED_MIME_TYPES.get(detectedMime) || '.png';
  return { mimeType: detectedMime, extension: ext };
}

export async function saveAsset(
  buffer: Buffer,
  originalFilename: string,
  options?: { organisationId?: string; declaredMimeType?: string }
): Promise<SavedAsset> {
  const { mimeType, extension } = validateAsset(buffer, originalFilename, options?.declaredMimeType);

  const uploadDir = getUploadDirectory();
  const orgPrefix = options?.organisationId ? `${options.organisationId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}-` : '';
  const safeFilename = `${orgPrefix}${crypto.randomUUID()}${extension}`;
  const filePath = path.join(uploadDir, safeFilename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    assetUrl: `/api/cms/assets/${safeFilename}`,
    filename: safeFilename,
    mimeType,
    size: buffer.length,
  };
}

export function getAssetPath(filename: string): { fullPath: string; mimeType: string } | null {
  // Strict filename format prevents directory traversal
  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/i.test(filename)) {
    return null;
  }

  const uploadDir = getUploadDirectory();
  const fullPath = path.join(uploadDir, path.basename(filename));

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const ext = path.extname(filename).toLowerCase();
  let mimeType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.svg') mimeType = 'image/svg+xml';

  return { fullPath, mimeType };
}
