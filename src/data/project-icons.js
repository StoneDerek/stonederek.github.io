import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Prepare each palette from the existing mark during the static build.
// The browser receives tiny ready-to-use SVG URLs, with no image requests.
const source = readFileSync(resolve('public/favicon.svg'), 'utf8').trim();
const escape = value => String(value).replace(/[&"<>]/g, character => ({
  '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'
})[character]);

export function projectIcon(palette) {
  const svg = source
    .replace(/(<rect\b[^>]*\bfill=")[^"]*"/, (_, prefix) => `${prefix}${escape(palette.accent)}"`)
    .replace(/(<text\b[^>]*\bfill=")[^"]*"/, (_, prefix) => `${prefix}${escape(palette.ink)}"`);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
