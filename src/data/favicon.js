import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const version = createHash('sha256').update(readFileSync(resolve('public/favicon.svg'))).digest('hex').slice(0, 12);
export const faviconURL = base => `${base}favicon.svg?v=${version}`;
