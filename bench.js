// bench.js — CPU time of solve.js vs the kit vendor readCsv on the 6
// practice cases (process.cpuUsage, several runs each), plus synthetic
// inputs of the same shape. Usage: node bench.js [runs]

import { readFileSync } from 'node:fs';
import { run as solveRun } from './solve.js';
import { readCsv as vendorRun } from '/home/hatch/workspace/makefun/kit-csv/csv-reader-speed-01-run-20261121-kit/program/generator/vendor/csv-reader/index.js';

const KIT = '/home/hatch/workspace/makefun/kit-csv/csv-reader-speed-01-run-20261121-kit';
const RUNS = Number(process.argv[2] ?? 5);

function cpuMs(fn, input) {
  const t0 = process.cpuUsage();
  fn(input);
  const t1 = process.cpuUsage(t0);
  return (t1.user + t1.system) / 1000;
}

function stats(times) {
  const s = [...times].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { min: s[0], med: s[(s.length / 2) | 0], mean };
}

const cases = JSON.parse(readFileSync(KIT + '/practice/input/cases.json', 'utf8'));

// Warm-up once (JIT + inline caches).
for (const c of cases) {
  solveRun(c.input);
  vendorRun(c.input);
}

console.log('practice cases (CPU ms per case, solve vs vendor):');
let totalSolve = 0;
let totalVendor = 0;
for (const c of cases) {
  const st = [];
  const vt = [];
  for (let r = 0; r < RUNS; r++) st.push(cpuMs(solveRun, c.input));
  for (let r = 0; r < RUNS; r++) vt.push(cpuMs(vendorRun, c.input));
  const s = stats(st);
  const v = stats(vt);
  totalSolve += s.mean;
  totalVendor += v.mean;
  console.log(
    `${c.id} len=${c.input.text.length} solve min=${s.min.toFixed(1)} med=${s.med.toFixed(1)} mean=${s.mean.toFixed(1)} | vendor min=${v.min.toFixed(1)} med=${v.med.toFixed(1)} mean=${v.mean.toFixed(1)} | speedup=${(v.mean / s.mean).toFixed(2)}x`,
  );
}
console.log(`TOTAL mean: solve=${totalSolve.toFixed(1)}ms vendor=${totalVendor.toFixed(1)}ms speedup=${(totalVendor / totalSolve).toFixed(2)}x`);

// Synthetic inputs of the same shape: plain rows, quoted rows, broken rows.
function synth(kind, rows, cols) {
  const parts = [];
  for (let r = 0; r < rows; r++) {
    const f = [];
    for (let c = 0; c < cols; c++) {
      if (kind === 'plain') f.push('v' + r + '_' + c);
      else if (kind === 'quoted') f.push(r % 3 === 0 ? '"q ' + r + ',' + c + '"' : 'v' + r + '_' + c);
      else f.push(r % 5 === 0 ? '"br\noken"' : r % 7 === 0 ? 'a\rb' : 'v' + r + '_' + c);
    }
    parts.push(f.join(','));
  }
  return parts.join('\n');
}
console.log('synthetic (100k rows x 9 cols):');
for (const kind of ['plain', 'quoted', 'broken']) {
  const input = { text: synth(kind, 100000, 9), header: true };
  const st = [];
  const vt = [];
  for (let r = 0; r < RUNS; r++) st.push(cpuMs(solveRun, input));
  for (let r = 0; r < RUNS; r++) vt.push(cpuMs(vendorRun, input));
  const s = stats(st);
  const v = stats(vt);
  console.log(
    `${kind} len=${input.text.length} solve med=${s.med.toFixed(1)}ms mean=${s.mean.toFixed(1)}ms | vendor med=${v.med.toFixed(1)}ms mean=${v.mean.toFixed(1)}ms | speedup=${(v.mean / s.mean).toFixed(2)}x`,
  );
}
