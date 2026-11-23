// test-practice.js — run main.ts over the 6 practice cases and diff the
// answers against practice/reference/expected.json. Exits 1 unless 6/6 match.
// Usage: node test-practice.js

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const KIT = '/home/hatch/workspace/makefun/kit-csv/csv-reader-speed-01-run-20261121-kit';
const NODE = '/home/hatch/workspace/tools/node-v22.23.4-linux-x64/bin/node';
const HERE = '/home/hatch/workspace/makefun/csv-acct3';

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

const cases = JSON.parse(readFileSync(KIT + '/practice/input/cases.json', 'utf8'));
const expected = JSON.parse(readFileSync(KIT + '/practice/reference/expected.json', 'utf8'));
const inDir = '/tmp/csv-test-in';
const outDir = '/tmp/csv-test-out';
rmSync(inDir, { recursive: true, force: true });
rmSync(outDir, { recursive: true, force: true });
mkdirSync(inDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(inDir + '/cases.json', JSON.stringify(cases));

const env = { ...process.env, MAKEFUN_INPUT_DIR: inDir, MAKEFUN_OUTPUT_DIR: outDir };
execFileSync(NODE, [HERE + '/main.ts'], { env, stdio: 'inherit' });

const answers = JSON.parse(readFileSync(outDir + '/answers.json', 'utf8'));
let ok = 0;
for (let i = 0; i < cases.length; i++) {
  const want = expected.cases[i].output;
  const got = answers[i];
  const same = deepEqual(got, want);
  console.log(cases[i].id, same ? 'MATCH' : 'MISMATCH');
  if (!same) {
    const gs = JSON.stringify(got);
    const ws = JSON.stringify(want);
    for (let k = 0; k < Math.min(gs.length, ws.length); k++) {
      if (gs[k] !== ws[k]) {
        console.log(' first diff at char', k);
        console.log(' got :', gs.slice(Math.max(0, k - 120), k + 200));
        console.log(' want:', ws.slice(Math.max(0, k - 120), k + 200));
        break;
      }
    }
    if (gs.length !== ws.length) console.log(' lengths got', gs.length, 'want', ws.length);
  } else {
    ok += 1;
  }
}
console.log(`practice: ${ok}/${cases.length} exact`);
process.exit(ok === cases.length ? 0 : 1);
