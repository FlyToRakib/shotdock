import { describe, expect, it } from 'vitest';
import { buildFilename, dataUrlByteSize, hostnameOf } from '../../src/utils/image';

const date = new Date(2026, 7, 17); // 17 Aug 2026, local time

describe('buildFilename', () => {
  it('names files {hostname}-{capture-type}-{date}.{ext}', () => {
    expect(
      buildFilename({ hostname: 'example.com', captureType: 'full-page', format: 'png', date }),
    ).toBe('example.com-full-page-2026-08-17.png');
  });

  it('uses the jpg extension for JPEG output', () => {
    expect(
      buildFilename({ hostname: 'github.com', captureType: 'visible', format: 'jpeg', date }),
    ).toBe('github.com-visible-2026-08-17.jpg');
  });

  it('drops the www prefix and normalises odd hostnames', () => {
    expect(
      buildFilename({ hostname: 'www.Example.co.uk', captureType: 'full-page', format: 'png', date }),
    ).toBe('example.co.uk-full-page-2026-08-17.png');
  });

  it('strips characters that would break a file path', () => {
    const name = buildFilename({
      hostname: 'weird/host:name?*',
      captureType: 'full-page',
      format: 'png',
      date,
    });
    expect(name).not.toMatch(/[/:?*\\]/);
    expect(name.endsWith('.png')).toBe(true);
  });

  it('never produces a path the downloads API would reject', () => {
    // A hostname is allowed to contain a run of dots, and `..` in a relative
    // download path is refused outright — so runs are collapsed, not just trimmed.
    const name = buildFilename({
      hostname: '..evil../..',
      captureType: 'full-page',
      format: 'png',
      date,
    });

    expect(name).not.toContain('..');
    expect(name).toBe('evil-full-page-2026-08-17.png');
  });

  it('keeps a long hostname from ending the name on a dot or dash', () => {
    const name = buildFilename({
      hostname: `${'a'.repeat(59)}.example.com`,
      captureType: 'visible',
      format: 'png',
      date,
    });

    expect(name).not.toContain('-.');
    expect(name).not.toContain('..');
    expect(name.endsWith('.png')).toBe(true);
  });

  it('adds a part suffix only when the capture was split', () => {
    expect(
      buildFilename({
        hostname: 'example.com',
        captureType: 'full-page',
        format: 'png',
        date,
        part: 0,
        totalParts: 1,
      }),
    ).toBe('example.com-full-page-2026-08-17.png');

    expect(
      buildFilename({
        hostname: 'example.com',
        captureType: 'full-page',
        format: 'png',
        date,
        part: 1,
        totalParts: 3,
      }),
    ).toBe('example.com-full-page-2026-08-17-part-2.png');
  });
});

describe('hostnameOf', () => {
  it('extracts the host, and degrades gracefully', () => {
    expect(hostnameOf('https://news.ycombinator.com/item?id=1')).toBe('news.ycombinator.com');
    expect(hostnameOf('not a url')).toBe('page');
    expect(hostnameOf(undefined)).toBe('page');
  });
});

describe('dataUrlByteSize', () => {
  it('estimates the decoded size of a data URL', () => {
    expect(dataUrlByteSize('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlByteSize('data:image/png;base64,AAA=')).toBe(2);
    expect(dataUrlByteSize('nonsense')).toBe(0);
  });
});
