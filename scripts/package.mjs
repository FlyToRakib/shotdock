/**
 * Packs dist/ into the ZIP the Chrome Web Store accepts.
 *
 * Writes the archive itself rather than pulling in a zip dependency: the format
 * needed here is a few headers wide, and the rest of the toolchain is already
 * dependency-free. Entries are stored with a fixed 1980-01-01 timestamp, so the
 * same dist/ always produces a byte-identical zip — which is what makes "is the
 * uploaded build the one I tested?" answerable by comparing hashes.
 */

import { deflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Source maps and OS noise are not part of the extension and only inflate the upload. */
const EXCLUDE = [/\.map$/, /(^|[\\/])\.DS_Store$/, /(^|[\\/])Thumbs\.db$/];

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const DOS_DATE = 0x0021; // 1980-01-01
const DOS_TIME = 0x0000; // 00:00:00

function buildZip(files) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    // Storing beats deflating when the payload is already compressed (PNG).
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    locals.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8); // flags
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, 0644
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, cdBuf, end]);
}

/**
 * public/manifest.json is the single source of truth for the release version —
 * bumping it there is all a release takes. Nothing else, package.json included,
 * gets a say.
 */
const version = JSON.parse(readFileSync(join(root, 'public', 'manifest.json'), 'utf8')).version;

let built;
try {
  built = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
} catch {
  console.error('No dist/manifest.json — run `npm run build` first.');
  process.exit(1);
}

/**
 * A stale dist/ would produce a zip whose filename claims one version while the
 * manifest inside it says another — the kind of mistake that is only discovered
 * after upload. Refuse instead.
 */
if (built.version !== version) {
  console.error(
    `dist/ is stale: it was built from version ${built.version}, but public/manifest.json ` +
      `is now ${version}. Run \`npm run build\`.`,
  );
  process.exit(1);
}

const all = walk(dist);
const skipped = all.filter((f) => EXCLUDE.some((re) => re.test(f)));
const files = all
  .filter((f) => !skipped.includes(f))
  // Zip entries are always forward-slashed, whatever the host separator is.
  .map((f) => ({ name: relative(dist, f).split(sep).join('/'), data: readFileSync(f) }));

if (!files.some((f) => f.name === 'manifest.json')) {
  console.error('manifest.json must be at the root of the archive.');
  process.exit(1);
}

const zip = buildZip(files);
const out = join(root, `shotdock-${version}.zip`);
writeFileSync(out, zip);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`${relative(root, out)}  ${kb(zip.length)}  ${files.length} files`);
console.log(`sha256  ${createHash('sha256').update(zip).digest('hex')}`);
for (const f of skipped) console.log(`excluded  ${relative(dist, f)}`);
