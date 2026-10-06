import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const pdf = resolve('public/resume.pdf');
export const hasResume = existsSync(pdf);
const version = hasResume ? createHash('sha256').update(readFileSync(pdf)).digest('hex').slice(0, 12) : '';
export const resumeURL = base => hasResume ? `${base}resume.pdf?v=${version}` : `${base}resume/`;
