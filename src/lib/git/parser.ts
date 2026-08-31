// Simple shell-like tokenizer supporting quoted strings
export type Parsed = { raw: string; cmd: string; args: string[]; flags: Map<string, string | true> };

export function parseInput(input: string): Parsed | null {
  const raw = input.trim();
  if (!raw) return null;
  const tokens = tokenize(raw);
  if (tokens.length === 0) return null;
  const cmd = tokens[0];
  const rest = tokens.slice(1);
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  let i = 0;
  while (i < rest.length) {
    const t = rest[i];
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      if (eq !== -1) {
        flags.set(t.slice(2, eq), t.slice(eq + 1));
      } else if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) {
        // --flag value  (e.g. --set-upstream)
        flags.set(t.slice(2), rest[i + 1]);
        i++;
      } else {
        flags.set(t.slice(2), true);
      }
    } else if (t.startsWith('-') && t.length > 1) {
      // -m "msg", -b, -d, -D, -c etc. Handle grouped but not needed heavily
      // For -m, next token is value
      const flagBody = t.slice(1);
      if (flagBody === 'm' && i + 1 < rest.length) {
        flags.set('m', rest[i + 1]);
        i++;
      } else if (flagBody.length === 1) {
        // single char flags like -b, -c, -d, -D
        for (const ch of flagBody) flags.set(ch, true);
      } else {
        // multi like -am, treat as individual
        for (const ch of flagBody) flags.set(ch, true);
      }
    } else {
      args.push(t);
    }
    i++;
  }
  return { raw, cmd, args, flags };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escaped) {
      current += c;
      escaped = false;
      continue;
    }
    if (c === '\\' && !inSingle) {
      escaped = true;
      continue;
    }
    if (c === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (c === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(c)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += c;
  }
  if (current) tokens.push(current);
  return tokens;
}
