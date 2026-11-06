import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
const runtimePrefixes=['client/src/','server/src/','shared/'];
const scopes=[
  'client/src','server/src','shared',
  'tests/fixtures/care-map-floating-canvas',
  'tests/fixtures/care-map-layer-inspector',
  'tests/fixtures/care-map-view-controls/vite.config.mjs',
  'tests/browser/care-map-floating-canvas-menu.mjs',
  'tests/browser/care-map-layer-inspector.mjs'
];
const extensions=/\.(?:js|jsx|ts|tsx|css|json|mjs|html)$/;

// Unlike the legacy dirty-file-only observer, include the clean baseline and
// new untracked runtime modules. Empty source inventories are never accepted.
export async function fingerprint(){
  const paths=[...new Set(execFileSync('git',[
    'ls-files','--cached','--others','--exclude-standard','--',...scopes
  ],{cwd:repo,encoding:'utf8'}).trim().split('\n').filter(p=>p&&extensions.test(p)))].sort();
  const runtimeFiles=paths.filter(p=>runtimePrefixes.some(prefix=>p.startsWith(prefix)));
  if(!runtimeFiles.length)throw new Error('Runtime source fingerprint is empty');
  const files=Object.fromEntries(await Promise.all(paths.map(async p=>[
    p,createHash('sha256').update(await fs.readFile(path.join(repo,p))).digest('hex')
  ])));
  return {
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
    runtimeFileCount:runtimeFiles.length,
    totalFileCount:paths.length,
    files
  };
}
