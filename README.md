# csv-reader-speed-01 — fast csv-reader 1.0.0 drop-in

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/fansevanoo/csv-acct3/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/fansevanoo/csv-acct3/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A fast, dependency-free ES module whose `run({text, header})` returns exactly
what csv-reader 1.0.0 returns (`{columns, rows, errors}`), but much faster:
slice-based field extraction with separate quoted and unquoted paths — each
field's end is found with `indexOf` from the field start and taken with
`text.slice`, a new string is built only when a quoted field holds `""`
escapes or CR handling, and newlines inside a quoted field are counted in
the same slice pass that converts them. No imports, no regex in the hot loop,
no `split()`, no caching across calls.

- `solve.js` — the fast implementation (`export function run(input)`).
- `main.ts` — the harness driver: reads `$MAKEFUN_INPUT_DIR/cases.json`,
  answers every case with `run()`, writes `$MAKEFUN_OUTPUT_DIR/answers.json`.
- `oracle.js` — a slow, literal reference written straight from the spec,
  used only to check `solve.js`.
- `fuzz.js`, `bench.js`, `test-practice.js` — correctness fuzzing, CPU
  benchmarking, and the 6/6 practice-set check.
