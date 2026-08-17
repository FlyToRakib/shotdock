import type { ImageFormat } from '../shared/types';

export const mimeFor = (format: ImageFormat): string =>
  format === 'jpeg' ? 'image/jpeg' : 'image/png';

export const extensionFor = (format: ImageFormat): string => (format === 'jpeg' ? 'jpg' : 'png');

/** Rough decoded size of a base64 data URL, without materialising the bytes. */
export function dataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.length - commaIndex - 1;
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64 * 3) / 4) - padding);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/** Builds `{hostname}-{capture-type}-{date}[-part-N].{ext}` and strips anything unsafe. */
export function buildFilename(options: {
  hostname: string;
  captureType: string;
  format: ImageFormat;
  date: Date;
  part?: number;
  totalParts?: number;
}): string {
  const { hostname, captureType, format, date, part, totalParts } = options;
  const host = sanitizeSegment(hostname) || 'page';
  const kind = sanitizeSegment(captureType) || 'capture';
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const suffix = totalParts && totalParts > 1 ? `-part-${(part ?? 0) + 1}` : '';
  return `${host}-${kind}-${stamp}${suffix}.${extensionFor(format)}`;
}

/**
 * Reduces a value to the safest thing that can appear in a path segment.
 *
 * The downloads API rejects a relative path containing `..`, and a hostname is
 * allowed to contain a run of dots — so runs are collapsed rather than merely
 * trimmed at the ends. The trailing trim runs last so slicing can't reintroduce
 * a name ending in a dot, which Windows will not accept.
 */
function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/^[-.]+|[-.]+$/g, '');
}

export function hostnameOf(url: string | undefined): string {
  if (!url) return 'page';
  try {
    return new URL(url).hostname || 'page';
  } catch {
    return 'page';
  }
}
