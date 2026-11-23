// fuzz.js — diff oracle.js vs solve.js (and vs the kit vendor readCsv)
// on random inputs. Usage: node fuzz.js [count]
// Exits non-zero and prints the failing input on the first mismatch.

import { run as oracleRun } from './oracle.js';
import { run as solveRun } from './solve.js';
import { readCsv as vendorRun } from '/home/hatch/workspace/makefun/kit-csv/csv-reader-speed-01-run-20261121-kit/program/generator/vendor/csv-reader/index.js';

const COUNT = Number(process.argv[2] ?? 100000);

// Canonical deep-equal: objects compared by key set, order-insensitive.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    for (let i = 0; i < ak.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

// Deterministic PRNG (mulberry32) so a failure reproduces.
let seed = 0x9e3779b9;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const ALPHA = [',', '"', '\r', '\n', '﻿', 'a', 'b'];

function randText(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[(rnd() * ALPHA.length) | 0];
  return s;
}

// Structured documents: lines of fields, some quoted, some broken.
function randDoc() {
  const lines = 1 + ((rnd() * 8) | 0);
  const parts = [];
  for (let l = 0; l < lines; l++) {
    const fields = 1 + ((rnd() * 5) | 0);
    const row = [];
    for (let f = 0; f < fields; f++) {
      const kind = rnd();
      if (kind < 0.25) {
        // Quoted field, maybe with escapes / newlines / junk / no close.
        let inner = '';
        const m = 1 + ((rnd() * 12) | 0);
        for (let k = 0; k < m; k++) {
          const r = rnd();
          if (r < 0.15) inner += '""';
          else if (r < 0.25) inner += '\r\n';
          else if (r < 0.3) inner += '\r';
          else if (r < 0.4) inner += '\n';
          else inner += rnd() < 0.5 ? 'a' : 'b';
        }
        let q = '"' + inner;
        if (rnd() < 0.8) {
          q += '"';
          if (rnd() < 0.2) q += rnd() < 0.5 ? 'x' : '\r';
        }
        row.push(q);
      } else if (kind < 0.4) {
        row.push(rnd() < 0.5 ? 'a' : 'ab');
      } else {
        row.push('');
      }
    }
    parts.push(row.join(','));
    const br = rnd();
    if (br < 0.7) parts.push('\n');
    else if (br < 0.85) parts.push('\r\n');
    else if (br < 0.95) parts.push('\r');
  }
  let t = parts.join('');
  if (rnd() < 0.1) t = '﻿' + t;
  return t;
}

let checked = 0;
let mismatches = 0;

function check(text, header, tag) {
  const input = { text, header };
  const o = oracleRun(input);
  const s = solveRun(input);
  const v = vendorRun(input);
  checked += 1;
  if (!deepEqual(o, s)) {
    mismatches += 1;
    console.log('MISMATCH oracle-vs-solve', tag, JSON.stringify(input));
    console.log(' oracle:', JSON.stringify(o).slice(0, 2000));
    console.log(' solve :', JSON.stringify(s).slice(0, 2000));
    process.exit(1);
  }
  if (!deepEqual(o, v)) {
    mismatches += 1;
    console.log('MISMATCH oracle-vs-vendor', tag, JSON.stringify(input));
    console.log(' oracle:', JSON.stringify(o).slice(0, 2000));
    console.log(' vendor:', JSON.stringify(v).slice(0, 2000));
    process.exit(1);
  }
  if (!deepEqual(s, v)) {
    mismatches += 1;
    console.log('MISMATCH solve-vs-vendor', tag, JSON.stringify(input));
    process.exit(1);
  }
}

// Hand-picked edge cases.
const edges = [
  '', '﻿', '﻿a,b', 'a', ',', ',,', '\n', '\r', '\r\n', '\n\n', 'a\n', 'a\r\nb',
  'a\rb', 'a\r\rb', '"', '""', '"""', '""""', '"a', '"a"', '"a"b', '"a""b"',
  '"a\r\nb"', '"a\rb"', '"a\nb"', '"a"x\r', '"a"\r', '"a"\r\nb', '"a",b',
  'a,"b\nc",d', '\r\na', 'a\n\nb', 'a,', ',a', 'a,,b', '"",', ',""',
  'a\r', '\ra', '\r\r', 'x\ry\nz', '"\n"', '"\r"', '﻿"a","b"\n"1","2"',
  'a,b\nc', 'a,b\nc,d,e', 'a\nb,c,d,e,f', '"unterminated', '"a\nb',
  '"a""b', '""""""', '"a"x,"b"y', '"a" ,b', 'a"b"c', 'a"b', '"a"junk\r\nb',
];
for (const t of edges) {
  check(t, true, 'edge');
  check(t, false, 'edge');
}

// Random alphabet fuzz, lengths 0-60.
for (let k = 0; k < COUNT; k++) {
  const len = (rnd() * 61) | 0;
  check(randText(len), rnd() < 0.5, 'rand' + k);
}

// Structured documents.
for (let k = 0; k < 20000; k++) {
  check(randDoc(), rnd() < 0.5, 'doc' + k);
}

console.log(`fuzz done: ${checked} inputs, ${mismatches} mismatches`);
