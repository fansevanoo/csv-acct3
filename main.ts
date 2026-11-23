// main.ts — the program the harness runs with `node /bot/main.ts`.
// It reads every case from $MAKEFUN_INPUT_DIR/cases.json (or /input),
// answers each one alone with run() from ./solve.js, and writes the
// answers in order to $MAKEFUN_OUTPUT_DIR/answers.json (or /output)
// as one JSON string in one write.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of
// its work runs under it, as the house baseline runs. This flag also keeps
// the timed runs free of incremental-marking pauses.
setFlagsFromString('--no-incremental-marking');

const { run } = await import(new URL('./solve.js', import.meta.url).href);

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(inDir, 'cases.json'), 'utf8'));
const answers = new Array(cases.length);
for (let k = 0; k < cases.length; k++) {
  const c = cases[k];
  answers[k] = run(c.input);
}
writeFileSync(join(outDir, 'answers.json'), JSON.stringify(answers));
