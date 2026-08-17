import type { ImageFormat } from '../shared/types';

/** The whole PNG-vs-JPEG decision, in one place, described the way users think about it. */
export const FORMATS: Record<
  ImageFormat,
  { label: string; hint: string; supportsQuality: boolean }
> = {
  png: {
    label: 'PNG',
    hint: 'Lossless — best for text, UI and screenshots',
    supportsQuality: false,
  },
  jpeg: {
    label: 'JPG',
    hint: 'Smaller file — best for photo-heavy pages',
    supportsQuality: true,
  },
};

export const supportsQuality = (format: ImageFormat): boolean => FORMATS[format].supportsQuality;
