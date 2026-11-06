import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const version = createHash('sha256').update(readFileSync(resolve('public/social-preview.png'))).digest('hex').slice(0, 12);

export const socialPreview = {
  width: 1200,
  height: 630,
  alt: 'Derek_Stone in light serif lettering on a dark background.'
};

export const socialPreviewURL = base => `${base}social-preview.png?v=${version}`;
