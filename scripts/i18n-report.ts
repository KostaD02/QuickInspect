import path from 'node:path';
import { run } from './i18n/report';

process.exitCode = run(path.resolve(import.meta.dirname, '..'));
