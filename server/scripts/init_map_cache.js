import { rebuildMapCache } from '../src/utils/cacheBuilder.js';

async function init() {
    console.log('Initializing global map cache...');
    await rebuildMapCache('all');
    console.log('Done.');
    process.exit(0);
}

init().catch(err => {
    console.error(err);
    process.exit(1);
});
