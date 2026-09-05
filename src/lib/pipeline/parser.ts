export interface ParsedInput {
  cmd: string;
  args: string[];
  flags: Map<string, string | true>;
}

export function parseInput(raw: string): ParsedInput | null {
  const tokens = tokenize(raw.trim());
  if (tokens.length === 0) return null;
  const [cmd, ...rest] = tokens;
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      if (eq !== -1) flags.set(t.slice(2, eq), t.slice(eq + 1));
      else if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) flags.set(t.slice(2), rest[++i]);
      else flags.set(t.slice(2), true);
    } else if (t === '-m' && i + 1 < rest.length) {
      args.push(t, rest[++i]);
    } else args.push(t);
  }
  return { cmd, args, flags };
}

function tokenize(raw: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && i + 1 < raw.length) out.push(cur), cur = '', out.push(raw[++i]);
      else cur += c;
    } else if (c === '"' || c === "'") quote = c;
    else if (/\s/.test(c)) {
      if (cur) out.push(cur), (cur = '');
    } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
