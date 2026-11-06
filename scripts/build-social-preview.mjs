import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = new URL('../src/assets/social-preview.svg', import.meta.url);
const destination = new URL('../public/social-preview.png', import.meta.url);
const cache = await mkdtemp(join(tmpdir(), 'portfolio-social-preview-'));
process.env.XDG_CACHE_HOME ??= cache;
try {
  const { default: sharp } = await import('sharp');
  const info = await sharp(await readFile(source)).png({ compressionLevel: 9 }).toFile(fileURLToPath(destination));
  console.log(`Exported social-preview.png (${info.width} × ${info.height}, ${Math.round(info.size / 1024)} KB).`);
} finally {
  await rm(cache, { recursive: true, force: true });
}
