import { useCallback, useMemo, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { LANGUAGES, usePersistedLanguage, type SupportedLanguage } from '../../lib/languages';
import { runCode } from '../../lib/execute';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import { useTheme } from '../../lib/theme';

interface CodePlaygroundProps {
  skillId: string;
  starterCode: Record<SupportedLanguage, string>;
}

export default function CodePlayground({ skillId, starterCode }: CodePlaygroundProps) {
  return (
    <ProgressProvider>
      <CodePlaygroundContent skillId={skillId} starterCode={starterCode} />
    </ProgressProvider>
  );
}

function CodePlaygroundContent({ skillId, starterCode }: CodePlaygroundProps) {
  const [language, setLanguage] = usePersistedLanguage();
  const [code, setCode] = useState(() => starterCode[language] ?? '');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { getStatus, setStatus } = useProgressContext();
  const theme = useTheme();

  const status = getStatus(skillId);

  const switchLanguage = useCallback(
    (lang: SupportedLanguage) => {
      setLanguage(lang);
      setCode(starterCode[lang] ?? '');
    },
    [setLanguage, starterCode],
  );

  const onRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setOutput('');
    try {
      const result = await runCode(language, code);
      setOutput(result.stdout);
      setError(result.stderr || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [language, code]);

  const editorLanguage = useMemo(
    () => LANGUAGES.find((l) => l.id === language)?.monacoLanguage ?? 'plaintext',
    [language],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2">
        <div className="flex gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => switchLanguage(l.id)}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                l.id === language
                  ? 'bg-sky-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCode(starterCode[language] ?? '')}
            className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
          >
            Reset
          </button>
          <button
            onClick={onRun}
            disabled={running}
            className="rounded bg-emerald-600 px-4 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'Running…' : '▶ Run'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={editorLanguage}
          value={code}
          onChange={(v) => setCode(v ?? '')}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-800">
        <div className="flex items-center justify-between px-4 py-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Output</span>
          <button
            onClick={() => setStatus(skillId, status === 'completed' ? 'in-progress' : 'completed')}
            className={`rounded px-3 py-1 text-xs font-medium transition ${
              status === 'completed'
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {status === 'completed' ? '✓ Completed' : 'Mark complete'}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 px-4 py-2 font-mono text-xs dark:bg-zinc-950">
          {output && <pre className="whitespace-pre-wrap text-emerald-300">{output}</pre>}
          {error && <pre className="whitespace-pre-wrap text-red-400">{error}</pre>}
          {!output && !error && (
            <span className="text-zinc-600">
              Press Run to execute your code via the Wandbox sandbox.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}