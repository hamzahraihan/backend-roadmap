import type { SupportedLanguage } from './languages';

const LIST_URL = 'https://wandbox.org/api/list.json';
const COMPILE_URL = 'https://wandbox.org/api/compile.json';

interface WandboxCompiler {
  name: string;
  version: string;
  language: string;
}

interface WandboxCompileResponse {
  status: string;
  compiler_error?: string;
  compiler_message?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
}

const LANGUAGE_TO_WANDBOX: Record<SupportedLanguage, string> = {
  go: 'Go',
  java: 'Java',
  typescript: 'TypeScript',
  python: 'Python',
};

let compilerCache: WandboxCompiler[] | null = null;

async function getCompiler(language: SupportedLanguage): Promise<string> {
  if (!compilerCache) {
    const res = await fetch(LIST_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch Wandbox compilers (${res.status})`);
    }
    compilerCache = (await res.json()) as WandboxCompiler[];
  }
  const target = LANGUAGE_TO_WANDBOX[language];
  const matches = compilerCache
    .filter(
      (c) =>
        c.language === target &&
        c.version &&
        !c.name.includes('head') &&
        !c.name.includes('pypy'),
    )
    .sort((a, b) => compareVersions(b.version, a.version));
  const chosen = matches[0];
  if (!chosen) {
    throw new Error(`No Wandbox compiler found for ${target}`);
  }
  return chosen.name;
}

function compareVersions(a: string, b: string): number {
  const an = a.split('.').map((n) => parseInt(n, 10) || 0);
  const bn = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(an.length, bn.length); i++) {
    const diff = (an[i] ?? 0) - (bn[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function runCode(language: SupportedLanguage, code: string): Promise<ExecutionResult> {
  const compiler = await getCompiler(language);
  const res = await fetch(COMPILE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      compiler,
      options: '',
      stdin: '',
    }),
  });
  if (!res.ok) {
    throw new Error(`Execution request failed (${res.status})`);
  }
  const data = (await res.json()) as WandboxCompileResponse;

  const stdout = data.program_output ?? data.program_message ?? '';
  const stderr = [data.compiler_error, data.compiler_message, data.program_error]
    .filter((s): s is string => Boolean(s))
    .join('\n')
    .trim();

  const failed = data.status !== '0' || Boolean(data.compiler_error);
  return { stdout: stdout.trim(), stderr, exitCode: failed ? 1 : 0 };
}
