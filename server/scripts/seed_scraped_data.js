const message = [
    'The legacy scraped-data seed has been retired.',
    'Use the canonical asset workbook flow instead:',
    '1. Run `npm run audit:clean-slate` to inspect the current database.',
    '2. Run `npm run reset:clean-slate -- --apply` if you want a content reset.',
    '3. Re-populate Places, Standalone Offerings, Templates, and Template Rollouts through the admin workbook tools.',
].join('\n');

console.error(message);
process.exitCode = 1;
