import { fileURLToPath } from 'node:url';

const message = [
    'The legacy database seed has been retired.',
    'Use the asset workbook import/export flow instead of direct schema seeding.',
    'Recommended sequence:',
    '1. `npm run audit:clean-slate`',
    '2. `npm run reset:clean-slate -- --apply`',
    '3. Import workbook data in this order: Places -> Standalone Offerings -> Templates -> Template Rollouts',
].join('\n');

export async function seed() {
    throw new Error(message);
}

const isDirectExecution = typeof process !== 'undefined'
    && process.argv?.[1]
    && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
    console.error(message);
    process.exitCode = 1;
}
