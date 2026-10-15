export type DocumentMediaType = 'pdf' | 'image' | 'video';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  apng: 'image/apng',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  '3gp': 'video/3gpp',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export function getDocumentMimeType(name: string, mimeType?: string): string {
  const normalizedMimeType = mimeType?.trim().toLowerCase();
  if (normalizedMimeType && normalizedMimeType !== 'application/octet-stream') {
    return normalizedMimeType;
  }
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

export function getDocumentMediaType(name: string, mimeType?: string): DocumentMediaType {
  const mime = getDocumentMimeType(name, mimeType);
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  throw new Error(`Le type de document de « ${name} » n’est pas pris en charge.`);
}

export function isSupportedDocument(name: string, mimeType?: string): boolean {
  try {
    getDocumentMediaType(name, mimeType);
    return true;
  } catch {
    return false;
  }
}
