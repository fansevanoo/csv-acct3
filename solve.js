// solve.js — fast csv-reader 1.0.0 drop-in, written from the spec.
// Angle: slice-based field extraction with separate quoted and unquoted
// paths. A field's end is found with indexOf from the field start and the
// field is taken with text.slice; a new string is built only when a quoted
// field holds "" escapes or CR handling. Newlines inside a quoted field are
// counted in the same slice pass that converts them. No imports, no regex in
// the hot loop, no split(), no caching across calls.

const COMMA = 0;
const BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  // No quote and no CR anywhere: the tight plain loop.
  if (text.indexOf('"') === -1 && text.indexOf('\r') === -1) {
    return plain(text, header, n, start);
  }
  return general(text, header, n, start, text.indexOf('\r') !== -1);
}

// Plain text: only ',' and '\n' exist. Records are sliced out whole, then
// their fields are sliced out of the record slice.
function plain(text, header, n, start) {
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let pos = start;
  let line = 1;
  while (pos < n) {
    while (pos < n && text.charCodeAt(pos) === 10) {
      pos += 1;
      line += 1;
    }
    if (pos >= n) break;
    const recLine = line;
    const recRow = header && columns === null ? null : rows.length;
    let recEnd = text.indexOf('\n', pos);
    const hasLF = recEnd !== -1;
    if (!hasLF) recEnd = n;
    const rec = text.slice(pos, recEnd);
    const fields = [];
    let s = 0;
    let c = rec.indexOf(',');
    while (c !== -1) {
      fields.push(rec.slice(s, c));
      s = c + 1;
      c = rec.indexOf(',', s);
    }
    fields.push(s === 0 ? rec : rec.slice(s));
    pos = hasLF ? recEnd + 1 : n;
    if (hasLF) line += 1;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

// General text: quotes and/or CRs present. Field ends are found with
// forward-only indexOf cursors (each cursor's scan never re-reads ground),
// so the whole pass stays linear.
function general(text, header, n, start, hasCR) {
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let pos = start;
  let line = 1;
  let recLine = 1;
  let recRow = null;
  // Next ',' / '\n' / '\r' at or after pos, or n + 1 when none is ahead.
  // A cursor below pos is stale and is re-found from pos on next use.
  let nextComma = -1;
  let nextLF = -1;
  let nextCR = -1;
  // The field just read.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  function err(code) {
    errors.push({ code, line: recLine, row: recRow });
  }

  // Read one unquoted field from `at`, starting from `init` (a string, or
  // null for a fresh field). Sets fValue / fEnded / fAdded.
  function readUnquoted(init, at) {
    let val = init;
    let added = 0;
    let s = at;
    pos = at;
    for (;;) {
      if (nextComma < pos) {
        const r = text.indexOf(',', pos);
        nextComma = r === -1 ? n + 1 : r;
      }
      if (nextLF < pos) {
        const r = text.indexOf('\n', pos);
        nextLF = r === -1 ? n + 1 : r;
      }
      let end;
      let kind;
      if (nextComma < nextLF) {
        end = nextComma;
        kind = COMMA;
      } else if (nextLF <= n) {
        end = nextLF;
        kind = BREAK;
      } else {
        end = n;
        kind = END;
      }
      if (hasCR) {
        if (nextCR < pos) {
          const r = text.indexOf('\r', pos);
          nextCR = r === -1 ? n + 1 : r;
        }
        if (nextCR < end) {
          if (text.charCodeAt(nextCR + 1) === 10) {
            if (nextCR > s) {
              const piece = text.slice(s, nextCR);
              val = val === null ? piece : val + piece;
              added += nextCR - s;
            }
            pos = nextCR + 2;
            line += 1;
            fValue = val === null ? '' : val;
            fEnded = BREAK;
            fAdded = added;
            return;
          }
          err('stray_cr');
          if (nextCR > s) {
            const piece = text.slice(s, nextCR);
            val = val === null ? piece : val + piece;
            added += nextCR - s;
          }
          pos = nextCR + 1;
          s = pos;
          nextCR = -1;
          continue;
        }
      }
      if (end > s) {
        const piece = text.slice(s, end);
        val = val === null ? piece : val + piece;
        added += end - s;
      }
      if (kind === COMMA) {
        pos = end + 1;
        fValue = val === null ? '' : val;
        fEnded = COMMA;
        fAdded = added;
        return;
      }
      if (kind === BREAK) {
        pos = end + 1;
        line += 1;
        fValue = val === null ? '' : val;
        fEnded = BREAK;
        fAdded = added;
        return;
      }
      pos = end;
      fValue = val === null ? '' : val;
      fEnded = END;
      fAdded = added;
      return;
    }
  }

  // Read one quoted field; pos is at its opening quote.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let cur = pos + 1;
    let value = '';
    for (;;) {
      const q = text.indexOf('"', cur);
      if (q === -1) {
        // Never closes: the quote is literal, the rest is re-read unquoted.
        pos = open + 1;
        line = openLine;
        err('unterminated_quote');
        readUnquoted('"', pos);
        return;
      }
      if (q > cur) {
        const seg = text.slice(cur, q);
        if (seg.indexOf('\r') !== -1 || seg.indexOf('\n') !== -1) {
          const conv = seg.replace(/\r\n?/g, '\n');
          let cnt = 0;
          let ix = conv.indexOf('\n');
          while (ix !== -1) {
            cnt += 1;
            ix = conv.indexOf('\n', ix + 1);
          }
          line += cnt;
          value += conv;
        } else {
          value += seg;
        }
      }
      if (text.charCodeAt(q + 1) === 34) {
        value += '"';
        cur = q + 2;
        continue;
      }
      pos = q + 1;
      if (pos >= n) {
        fValue = value;
        fEnded = END;
        fAdded = 0;
        return;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 44) {
        pos += 1;
        fValue = value;
        fEnded = COMMA;
        fAdded = 0;
        return;
      }
      if (ch === 10) {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = BREAK;
        fAdded = 0;
        return;
      }
      if (ch === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = BREAK;
        fAdded = 0;
        return;
      }
      // Junk after the closing quote, appended as it stands.
      readUnquoted(value, pos);
      if (fAdded > 0) err('quote_junk');
      return;
    }
  }

  for (;;) {
    while (pos < n) {
      const ch = text.charCodeAt(pos);
      if (ch === 10) {
        pos += 1;
        line += 1;
      } else if (ch === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recLine = line;
    recRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted;
    do {
      lastQuoted = text.charCodeAt(pos) === 34;
      if (lastQuoted) readQuoted();
      else readUnquoted(null, pos);
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line holding only stray CRs has no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
