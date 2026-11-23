// oracle.js — slow, literal reference implementation of csv-reader 1.0.0,
// written straight from the spec. Used only to check solve.js; not graded.
// One character at a time, no shortcuts.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let i = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  // Error for the record currently being read.
  let recLine = 1;
  let recRow = null;
  function pushErr(code) {
    errors.push({ code, line: recLine, row: recRow });
  }

  // Read one unquoted field starting at i, with `start` already in value.
  // Returns 'comma' | 'break' | 'end'. Counts kept chars in `added`.
  function unquoted(value) {
    let added = 0;
    while (i < n) {
      const ch = text[i];
      if (ch === ',') {
        i += 1;
        return { value, end: 'comma', added };
      }
      if (ch === '\n') {
        i += 1;
        line += 1;
        return { value, end: 'break', added };
      }
      if (ch === '\r') {
        if (text[i + 1] === '\n') {
          i += 2;
          line += 1;
          return { value, end: 'break', added };
        }
        pushErr('stray_cr');
        i += 1;
        continue;
      }
      value += ch;
      added += 1;
      i += 1;
    }
    return { value, end: 'end', added };
  }

  // Read one quoted field; i is at its opening quote.
  // Returns the same shape as unquoted.
  function quoted() {
    const open = i;
    const openLine = line;
    let value = '';
    i += 1;
    let closed = false;
    while (i < n) {
      const ch = text[i];
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i += 2;
          continue;
        }
        i += 1;
        closed = true;
        break;
      }
      if (ch === '\r') {
        value += '\n';
        line += 1;
        i += text[i + 1] === '\n' ? 2 : 1;
        continue;
      }
      if (ch === '\n') line += 1;
      value += ch;
      i += 1;
    }
    if (!closed) {
      // Never closed: the quote is literal, the rest is re-read unquoted.
      i = open + 1;
      line = openLine;
      pushErr('unterminated_quote');
      return unquoted('"');
    }
    if (i >= n) return { value, end: 'end', added: 0 };
    const ch = text[i];
    if (ch === ',') {
      i += 1;
      return { value, end: 'comma', added: 0 };
    }
    if (ch === '\n') {
      i += 1;
      line += 1;
      return { value, end: 'break', added: 0 };
    }
    if (ch === '\r' && text[i + 1] === '\n') {
      i += 2;
      line += 1;
      return { value, end: 'break', added: 0 };
    }
    // Junk after the closing quote, appended as it stands.
    const junk = unquoted(value);
    if (junk.added > 0) pushErr('quote_junk');
    return junk;
  }

  for (;;) {
    // A line with zero characters is no record.
    while (i < n) {
      if (text[i] === '\n') {
        i += 1;
        line += 1;
      } else if (text[i] === '\r' && text[i + 1] === '\n') {
        i += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (i >= n) break;

    recLine = line;
    recRow = header && columns === null ? null : rows.length;
    const fields = [];
    let f;
    let wasQuoted;
    do {
      wasQuoted = text[i] === '"';
      f = wasQuoted ? quoted() : unquoted('');
      fields.push(f.value);
    } while (f.end === 'comma');

    // A line holding only stray CRs has no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !wasQuoted) continue;

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
